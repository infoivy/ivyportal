import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ListSkeleton } from "@/components/ui/skeletons";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import {
  ExternalLink, Zap, Search, DollarSign, Users, Phone, TrendingUp, CheckCircle2, Trash2, RefreshCw, Loader2,
  StickyNote, Pin, X, Send,
} from "lucide-react";
import {
  getCloseStatus, saveCloseApiKey, testCloseConnection, listCloseLeads, deleteCloseApiKey,
} from "@/lib/close-crm.functions";
import {
  listLeadNotes, createLeadNote, updateLeadNote, deleteLeadNote, countLeadNotes,
  type LeadNote,
} from "@/lib/crm-lead-notes.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — ISA Team" }] }),
  component: Crm,
});

type Lead = {
  id: string; name: string; status: string; status_type: string; value: number; updated_at: string;
};

const STATUS_TYPE_COLOR: Record<string, string> = {
  active: "#3b82f6",
  won: "#22c55e",
  lost: "#ef4444",
  "": "#64748b",
};

function currency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n}`;
}

function relTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Crm() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const getStatus = useServerFn(getCloseStatus);
  const listLeads = useServerFn(listCloseLeads);
  const countNotes = useServerFn(countLeadNotes);

  const [connected, setConnected] = useState<boolean | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const refresh = async (query = "") => {
    setLoading(true);
    try {
      const s = await getStatus();
      const isConn = !!s?.configured;
      setConnected(isConn);
      if (isConn) {
        const r = await listLeads({ data: { query } });
        const arr = (r?.leads ?? []) as Lead[];
        setLeads(arr);
        if (arr.length) {
          try {
            const counts = await countNotes({ data: { leadIds: arr.map((l) => l.id) } });
            setNoteCounts(counts ?? {});
          } catch { /* ignore */ }
        } else {
          setNoteCounts({});
        }
      } else {
        setLeads([]);
        setNoteCounts({});
      }
      setLastSyncedAt(new Date());
    } finally {
      setLoading(false);
    }
  };
  const refreshNoteCount = async (leadId: string) => {
    try {
      const counts = await countNotes({ data: { leadIds: [leadId] } });
      setNoteCounts((prev) => ({ ...prev, [leadId]: counts?.[leadId] ?? 0 }));
    } catch { /* ignore */ }
  };
  useEffect(() => { refresh(""); }, []);

  // debounced live search
  useEffect(() => {
    if (!connected) return;
    const t = setTimeout(() => refresh(q), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, connected]);

  const statuses = useMemo(() => {
    const set = new Map<string, number>();
    leads.forEach((l) => set.set(l.status, (set.get(l.status) ?? 0) + 1));
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? leads : leads.filter((l) => l.status === statusFilter)),
    [leads, statusFilter],
  );

  const pipeline = useMemo(() => {
    const groups = new Map<string, { count: number; value: number; color: string }>();
    for (const l of filtered) {
      const g = groups.get(l.status) ?? { count: 0, value: 0, color: STATUS_TYPE_COLOR[l.status_type] ?? "#a855f7" };
      g.count += 1; g.value += l.value;
      groups.set(l.status, g);
    }
    return [...groups.entries()]
      .map(([stage, v]) => ({ stage, ...v }))
      .sort((a, b) => b.value - a.value || b.count - a.count);
  }, [filtered]);

  const totalValue = filtered.reduce((a, l) => a + l.value, 0);
  const activeDeals = filtered.filter((l) => l.status_type === "active" || l.value > 0).length;
  const wonCount = filtered.filter((l) => l.status_type === "won").length;
  const closeRate = filtered.length ? ((wonCount / filtered.length) * 100).toFixed(1) + "%" : "—";

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight">CRM Pipeline</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {connected === null ? "Loading…" : connected ? `Close CRM · ${leads.length} leads` : "Close CRM sync · not connected"}
              {connected && lastSyncedAt && (
                <span className="ml-1.5">· synced {lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {connected && (
              <button
                onClick={() => refresh(q)}
                disabled={loading}
                className="inline-flex items-center justify-center h-7 w-7 rounded-sm border border-border hover:border-success/25"
                title="Refresh"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </button>
            )}
            {connected ? (
              <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-sm bg-success-bg text-success-fg border border-success/25">
                <CheckCircle2 className="h-3 w-3" /> Live
              </div>
            ) : (
              <div className="text-[10px] font-semibold px-2 py-1 rounded-sm bg-warning-bg text-warning-fg border border-warning/25">
                Offline
              </div>
            )}
            {isAdmin && (
              <button
                onClick={() => setOpenDialog(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-sm bg-success text-black hover:bg-success"
              >
                <Zap className="h-3 w-3" /> {connected ? "Manage" : "Connect"}
              </button>
            )}
          </div>
        </div>

        {!connected && connected !== null && (
          <div className="rounded-md border border-border bg-muted p-2.5 flex items-start gap-2.5">
            <div className="grid h-5 w-5 place-items-center rounded-sm bg-muted shrink-0">
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="text-xs flex-1">
              <p className="font-semibold text-muted-foreground mb-0.5">Not connected</p>
              <p className="text-muted-foreground text-[11px]">
                {isAdmin ? "Paste your Close API key to sync real pipeline data." : "Ask an admin to add the Close API key."}
              </p>
            </div>
          </div>
        )}

        {/* KPI row — dense */}
        <div className="grid grid-cols-4 gap-1.5">
          <StatCard icon={Users} label="Leads" value={connected ? String(filtered.length) : "—"} color="#3b82f6" />
          <StatCard icon={Phone} label="Active" value={connected ? String(activeDeals) : "—"} color="#a855f7" />
          <StatCard icon={DollarSign} label="Pipeline" value={connected ? currency(totalValue) : "—"} color="#22c55e" />
          <StatCard icon={TrendingUp} label="Close rate" value={connected ? closeRate : "—"} color="#f59e0b" />
        </div>

        {/* Search + status filter row */}
        <div className="rounded-md border border-border bg-card p-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={connected ? "Search leads by name, email, phone…" : "Connect Close to search"}
                disabled={!connected}
                className="w-full h-8 pl-8 pr-3 rounded-sm border border-border bg-muted text-xs disabled:opacity-50 focus:outline-none focus:border-ring"
              />
            </div>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          {statuses.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")} label={`All · ${leads.length}`} />
              {statuses.map(([s, n]) => (
                <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} label={`${s} · ${n}`} />
              ))}
            </div>
          )}
        </div>

        {/* Pipeline — live */}
        {connected && pipeline.length > 0 && (
          <div className="rounded-md border border-border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground">Deal Pipeline</h3>
              <span className="text-[10px] text-muted-foreground tabular-nums">{currency(totalValue)} total</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5">
              {pipeline.slice(0, 10).map((p) => (
                <button
                  key={p.stage}
                  onClick={() => setStatusFilter(p.stage === statusFilter ? "all" : p.stage)}
                  className={
                    "text-left rounded-sm border p-2.5 bg-muted hover:bg-muted transition " +
                    (statusFilter === p.stage ? "border-success/25" : "border-border")
                  }
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                    <span className="text-[9px] text-muted-foreground truncate">{p.stage}</span>
                  </div>
                  <div className="text-xl font-medium tabular-nums leading-none" style={{ color: p.color }}>{p.count}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">{currency(p.value)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Leads table */}
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground">
              {q ? `Results for "${q}"` : "Recent activity"}
            </h3>
            <span className="text-[10px] text-muted-foreground tabular-nums">{filtered.length} shown</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-10 text-center text-xs text-muted-foreground space-y-1">
              {!connected ? (
                <>Connect Close to see live data.</>
              ) : loading && leads.length === 0 ? (
                <>Loading leads…</>
              ) : leads.length === 0 ? (
                <>
                  <div className="text-sm text-foreground">No leads yet</div>
                  <div>Add your first lead in Close and it'll show up here.</div>
                </>
              ) : (
                <>No leads match {q ? `"${q}"` : "the current filters"}.</>
              )}
            </div>
          ) : (
            <div className="max-h-[520px] overflow-auto overscroll-contain">
              {filtered.slice(0, 100).map((l) => {
                const c = STATUS_TYPE_COLOR[l.status_type] ?? "#a855f7";
                const nc = noteCounts[l.id] ?? 0;
                return (
                  <button
                    key={l.id}
                    onClick={() => setActiveLead(l)}
                    className="w-full text-left grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-3 py-2 border-b border-border/50 last:border-0 hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{l.name}</div>
                      <div className="text-[10px] mt-0.5 truncate" style={{ color: c }}>{l.status}</div>
                    </div>
                    <span
                      className={
                        "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-sm border " +
                        (nc > 0
                          ? "border-border bg-muted text-muted-foreground"
                          : "border-border/60 text-muted-foreground")
                      }
                      title={nc === 1 ? "1 internal note" : `${nc} internal notes`}
                    >
                      <StickyNote className="h-3 w-3" />
                      {nc}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-success-fg">{l.value > 0 ? currency(l.value) : "—"}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">{relTime(l.updated_at)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <CloseKeyDialog open={openDialog} onOpenChange={setOpenDialog} connected={!!connected} onChanged={() => refresh(q)} />
      )}
      <LeadDetailDrawer
        lead={activeLead}
        onClose={() => setActiveLead(null)}
        onNotesChanged={(id) => refreshNoteCount(id)}
      />
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "text-[10px] px-2 py-0.5 rounded-sm border tabular-nums transition " +
        (active
          ? "bg-success-bg border-success/25 text-success-fg"
          : "bg-muted border-border text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </button>
  );
}

function CloseKeyDialog({
  open, onOpenChange, connected, onChanged,
}: { open: boolean; onOpenChange: (v: boolean) => void; connected: boolean; onChanged: () => void }) {
  const save = useServerFn(saveCloseApiKey);
  const test = useServerFn(testCloseConnection);
  const del = useServerFn(deleteCloseApiKey);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (open) { setApiKey(""); setResult(null); }
  }, [open]);

  const handleSaveAndTest = async () => {
    if (!apiKey.trim()) return toast.error("Paste your Close API key first");
    setSaving(true);
    try {
      await save({ data: { apiKey: apiKey.trim() } });
      setSaving(false);
      setTesting(true);
      const t = await test();
      setTesting(false);
      if (t.ok) {
        setResult({ ok: true, msg: `Connected as ${t.user}${t.organization ? ` (${t.organization})` : ""}` });
        toast.success("Close CRM connected");
        onChanged();
      } else {
        setResult({ ok: false, msg: t.error ?? "Test failed" });
      }
    } catch (e: any) {
      setSaving(false); setTesting(false);
      toast.error(e?.message ?? "Failed to save key");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Remove the stored Close API key?")) return;
    await del();
    toast.success("Disconnected");
    onOpenChange(false);
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Close CRM</DialogTitle>
          <DialogDescription>
            Paste your Close API key (Close → Settings → Developer → API Keys). Stored server-side and only used to fetch pipeline data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>API key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="api_…"
              autoComplete="off"
            />
          </div>
          {result && (
            <div
              className={
                "text-xs px-3 py-2 rounded-sm border " +
                (result.ok
                  ? "border-success/25 bg-success-bg text-success-fg"
                  : "border-danger/25 bg-danger-bg text-danger-fg")
              }
            >
              {result.msg}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">Only admins can view or update this key.</p>
        </div>
        <DialogFooter className="gap-2">
          {connected && (
            <Button variant="outline" onClick={handleDisconnect} className="mr-auto text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Disconnect
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSaveAndTest} disabled={saving || testing}>
            {saving ? "Saving…" : testing ? "Testing…" : "Save & test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
        <Icon className="h-2.5 w-2.5" style={{ color }} />
        {label}
      </div>
      <div className="text-lg font-medium tabular-nums mt-0.5 leading-tight" style={{ color }}>{value}</div>
    </div>
  );
}

function LeadDetailDrawer({
  lead, onClose, onNotesChanged,
}: { lead: Lead | null; onClose: () => void; onNotesChanged: (leadId: string) => void }) {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const list = useServerFn(listLeadNotes);
  const create = useServerFn(createLeadNote);
  const update = useServerFn(updateLeadNote);
  const del = useServerFn(deleteLeadNote);

  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    if (!lead) return;
    let alive = true;
    setLoading(true);
    list({ data: { leadId: lead.id } })
      .then((rows) => { if (alive) setNotes(rows ?? []); })
      .catch((e: any) => toast.error(e?.message ?? "Failed to load notes"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [lead?.id]);

  if (!lead) return null;

  const submit = async () => {
    const txt = body.trim();
    if (!txt) return;
    setSaving(true);
    try {
      await create({ data: { leadId: lead.id, leadName: lead.name, body: txt, pinned } });
      setBody(""); setPinned(false);
      const rows = await list({ data: { leadId: lead.id } });
      setNotes(rows ?? []);
      onNotesChanged(lead.id);
      toast.success("Note added");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (n: LeadNote) => {
    try {
      await update({ data: { id: n.id, pinned: !n.pinned } });
      const rows = await list({ data: { leadId: lead.id } });
      setNotes(rows ?? []);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const saveEdit = async (n: LeadNote) => {
    const txt = editBody.trim();
    if (!txt) return;
    try {
      await update({ data: { id: n.id, body: txt } });
      setEditingId(null); setEditBody("");
      const rows = await list({ data: { leadId: lead.id } });
      setNotes(rows ?? []);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const remove = async (n: LeadNote) => {
    if (!confirm("Delete this note?")) return;
    try {
      await del({ data: { id: n.id } });
      const rows = await list({ data: { leadId: lead.id } });
      setNotes(rows ?? []);
      onNotesChanged(lead.id);
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  const c = STATUS_TYPE_COLOR[lead.status_type] ?? "#a855f7";

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button onClick={onClose} className="flex-1 bg-black/60" aria-label="Close" />
      <aside className="w-full max-w-[520px] bg-[#0b0d12] border-l border-border h-full overflow-y-auto overscroll-contain flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3 sticky top-0 bg-[#0b0d12] z-10">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{lead.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px]" style={{ color: c }}>{lead.status}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-success-fg">{lead.value > 0 ? currency(lead.value) : "—"}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground">updated {relTime(lead.updated_at)}</span>
            </div>
          </div>
          <button onClick={onClose} className="h-7 w-7 grid place-items-center rounded-sm border border-border hover:border-danger/25">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-3 border-b border-border">
          <div className="text-[10px] text-muted-foreground font-semibold">Add internal note</div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened on this lead? Context, follow-up, objections…"
            rows={3}
            className="w-full text-xs bg-muted border border-border rounded-sm p-2 focus:outline-none focus:border-ring resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
              <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(v === true)} className="h-3.5 w-3.5" />
              <Pin className="h-3 w-3" /> Pin to top
            </label>
            <Button size="sm" onClick={submit} disabled={saving || !body.trim()}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Send className="h-3 w-3 mr-1" /> Save note</>}
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4">
          <div className="text-[10px] text-muted-foreground font-semibold mb-2">
            History · {notes.length} {notes.length === 1 ? "note" : "notes"}
          </div>
          {loading ? (
            <ListSkeleton rows={4} />
          ) : notes.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-sm">
              No notes yet. Log the first one above.
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => {
                const canEdit = isAdmin || n.created_by === user?.id;
                const editing = editingId === n.id;
                return (
                  <div key={n.id} className="rounded-sm border border-border bg-muted p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {n.pinned && <Pin className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <span className="text-[11px] font-medium truncate">{n.author_name || "Team member"}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{relTime(n.created_at)}</span>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => togglePin(n)}
                            title={n.pinned ? "Unpin" : "Pin"}
                            className="h-6 w-6 grid place-items-center rounded-sm hover:bg-muted text-muted-foreground hover:text-muted-foreground"
                          >
                            <Pin className="h-3 w-3" />
                          </button>
                          {!editing && (
                            <button
                              onClick={() => { setEditingId(n.id); setEditBody(n.body); }}
                              className="text-[10px] px-1.5 py-0.5 rounded-sm border border-border text-muted-foreground hover:text-foreground"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => remove(n)}
                            title="Delete"
                            className="h-6 w-6 grid place-items-center rounded-sm hover:bg-muted text-muted-foreground hover:text-danger-fg"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    {editing ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={3}
                          className="w-full text-xs bg-muted border border-border rounded-sm p-2 focus:outline-none focus:border-ring"
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditBody(""); }}>Cancel</Button>
                          <Button size="sm" onClick={() => saveEdit(n)}>Save</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs whitespace-pre-wrap leading-relaxed">{n.body}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
