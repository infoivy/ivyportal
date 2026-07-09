import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import {
  ExternalLink, Zap, Search, DollarSign, Users, Phone, TrendingUp, CheckCircle2, Trash2, RefreshCw, Loader2,
} from "lucide-react";
import {
  getCloseStatus, saveCloseApiKey, testCloseConnection, listCloseLeads, deleteCloseApiKey,
} from "@/lib/close-crm.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

  const [connected, setConnected] = useState<boolean | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const refresh = async (query = "") => {
    setLoading(true);
    try {
      const s = await getStatus();
      const isConn = !!s?.configured;
      setConnected(isConn);
      if (isConn) {
        const r = await listLeads({ data: { query } });
        setLeads((r?.leads ?? []) as Lead[]);
      } else {
        setLeads([]);
      }
    } finally {
      setLoading(false);
    }
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
    <div className="dashboard-dark min-h-full">
      <div className="max-w-[1400px] mx-auto p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">CRM Pipeline</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {connected === null ? "Loading…" : connected ? `Close CRM · ${leads.length} leads` : "Close CRM sync · not connected"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {connected && (
              <button
                onClick={() => refresh(q)}
                disabled={loading}
                className="inline-flex items-center justify-center h-7 w-7 rounded-sm border border-border hover:border-emerald-500/40"
                title="Refresh"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </button>
            )}
            {connected ? (
              <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                <CheckCircle2 className="h-3 w-3" /> Live
              </div>
            ) : (
              <div className="text-[10px] font-semibold px-2 py-1 rounded-sm bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                Offline
              </div>
            )}
            {isAdmin && (
              <button
                onClick={() => setOpenDialog(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-sm bg-emerald-500 text-black hover:bg-emerald-400"
              >
                <Zap className="h-3 w-3" /> {connected ? "Manage" : "Connect"}
              </button>
            )}
          </div>
        </div>

        {!connected && connected !== null && (
          <div className="rounded-md border border-blue-500/40 bg-blue-500/5 p-2.5 flex items-start gap-2.5">
            <div className="grid h-5 w-5 place-items-center rounded-sm bg-blue-500/20 shrink-0">
              <ExternalLink className="h-3 w-3 text-blue-400" />
            </div>
            <div className="text-xs flex-1">
              <p className="font-semibold text-blue-400 mb-0.5">Not connected</p>
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
                className="w-full h-8 pl-8 pr-3 rounded-sm border border-border bg-white/[0.02] text-xs disabled:opacity-50 focus:outline-none focus:border-emerald-500/40"
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Deal Pipeline</h3>
              <span className="text-[10px] text-muted-foreground tabular-nums">{currency(totalValue)} total</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5">
              {pipeline.slice(0, 10).map((p) => (
                <button
                  key={p.stage}
                  onClick={() => setStatusFilter(p.stage === statusFilter ? "all" : p.stage)}
                  className={
                    "text-left rounded-sm border p-2.5 bg-white/[0.01] hover:bg-white/[0.03] transition " +
                    (statusFilter === p.stage ? "border-emerald-500/50" : "border-border")
                  }
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">{p.stage}</span>
                  </div>
                  <div className="text-xl font-bold tabular-nums leading-none" style={{ color: p.color }}>{p.count}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">{currency(p.value)}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Leads table */}
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {q ? `Results for "${q}"` : "Recent activity"}
            </h3>
            <span className="text-[10px] text-muted-foreground tabular-nums">{filtered.length} shown</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              {connected ? (loading ? "Loading…" : "No leads match.") : "Connect Close to see live data."}
            </div>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              {filtered.slice(0, 100).map((l) => {
                const c = STATUS_TYPE_COLOR[l.status_type] ?? "#a855f7";
                return (
                  <div
                    key={l.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2 border-b border-border/50 last:border-0 hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{l.name}</div>
                      <div className="text-[10px] mt-0.5 truncate" style={{ color: c }}>{l.status}</div>
                    </div>
                    <span className="text-xs font-bold tabular-nums text-emerald-400">{l.value > 0 ? currency(l.value) : "—"}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">{relTime(l.updated_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <CloseKeyDialog open={openDialog} onOpenChange={setOpenDialog} connected={!!connected} onChanged={() => refresh(q)} />
      )}
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
          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
          : "bg-white/[0.02] border-border text-muted-foreground hover:text-foreground")
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
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                  : "border-rose-500/30 bg-rose-500/5 text-rose-400")
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
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-2.5 w-2.5" style={{ color }} />
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums mt-0.5 leading-tight" style={{ color }}>{value}</div>
    </div>
  );
}
