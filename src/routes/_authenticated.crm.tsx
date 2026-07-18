import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import {
  ExternalLink, Zap, DollarSign, Users, Phone, TrendingUp, CheckCircle2, RefreshCw, Loader2, Trophy,
} from "lucide-react";
import {
  getCloseStatus, saveCloseApiKey, testCloseConnection, listCloseLeads, deleteCloseApiKey,
  getCloseContactCompliance,
} from "@/lib/close-crm.functions";
import { useQuery } from "@tanstack/react-query";
import { MochiCrmInner } from "@/components/mochi-crm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM · ISA Team" }] }),
  component: CrmPage,
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

/**
 * One CRM page (founder-confirmed 2026-07-12): the Mochi dashboard replica
 * plus a Close pipeline summary — lead counts, stage breakdown, pipeline
 * value. Working leads (calls, notes, statuses) happens in Close itself.
 */
function CrmPage() {
  const { roles } = useAuth();
  const canMochi = roles.includes("admin") || roles.includes("founder") || roles.includes("cofounder");
  const canClose = roles.includes("admin") || roles.includes("closer") || roles.includes("cofounder");

  if (!canMochi && !canClose) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="card-surface p-8 text-center text-[13px] text-muted-foreground">CRM access required.</div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="max-w-[1400px] mx-auto p-3 sm:p-4 space-y-4">
        {canClose && <ClosePipelineSummary />}
        {canMochi && <MochiCrmInner embedded />}
      </div>
    </div>
  );
}

function ClosePipelineSummary() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const getStatus = useServerFn(getCloseStatus);
  const listLeads = useServerFn(listCloseLeads);

  const [connected, setConnected] = useState<boolean | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getStatus();
      const isConn = !!s?.configured;
      setConnected(isConn);
      if (isConn) {
        const r = await listLeads({ data: { query: "" } });
        setLeads(((r?.leads ?? []) as Lead[]));
        setLastSyncedAt(new Date());
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [getStatus, listLeads]);
  useEffect(() => { void refresh(); }, [refresh]);

  const stages = useMemo(() => {
    const groups = new Map<string, { count: number; value: number; color: string }>();
    for (const l of leads) {
      const g = groups.get(l.status) ?? { count: 0, value: 0, color: STATUS_TYPE_COLOR[l.status_type] ?? "#a855f7" };
      g.count += 1; g.value += l.value;
      groups.set(l.status, g);
    }
    return [...groups.entries()]
      .map(([stage, v]) => ({ stage, ...v }))
      .sort((a, b) => b.value - a.value || b.count - a.count);
  }, [leads]);

  const totalValue = leads.reduce((a, l) => a + l.value, 0);
  const activeDeals = leads.filter((l) => l.status_type === "active" || l.value > 0).length;
  const wonCount = leads.filter((l) => l.status_type === "won").length;
  const closeRate = leads.length ? ((wonCount / leads.length) * 100).toFixed(1) + "%" : "–";

  return (
    <div className="card-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-foreground">Close pipeline</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {connected === null ? "Loading…" : connected ? `${leads.length} leads` : "not connected"}
            {connected && lastSyncedAt && <> · synced {lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>}
            {connected && <> · calls, notes & statuses live in Close</>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {connected && (
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center justify-center h-7 w-7 rounded-sm border border-border hover:bg-muted motion-safe:transition-colors"
              title="Refresh"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </button>
          )}
          <a
            href="https://app.close.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-sm border border-border text-muted-foreground hover:text-foreground motion-safe:transition-colors"
          >
            <ExternalLink className="h-3 w-3" /> Open Close
          </a>
          {connected ? (
            <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-sm bg-success-bg text-success-fg border border-success/25">
              <CheckCircle2 className="h-3 w-3" /> Live
            </div>
          ) : connected === false ? (
            <div className="text-[10px] font-semibold px-2 py-1 rounded-sm bg-warning-bg text-warning-fg border border-warning/25">Offline</div>
          ) : null}
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setOpenDialog(true)}>
              <Zap className="h-3 w-3 mr-1" /> {connected ? "Manage" : "Connect"}
            </Button>
          )}
        </div>
      </div>

      {connected === false && (
        <p className="text-[12px] text-muted-foreground">
          {isAdmin ? "Paste your Close API key to pull pipeline numbers." : "Ask an admin to add the Close API key."}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        <Kpi icon={Users} label="Leads" value={connected ? String(leads.length) : "–"} />
        <Kpi icon={Phone} label="Active" value={connected ? String(activeDeals) : "–"} />
        <Kpi icon={Trophy} label="Won" value={connected ? String(wonCount) : "–"} />
        <Kpi icon={DollarSign} label="Pipeline" value={connected ? currency(totalValue) : "–"} />
        <Kpi icon={TrendingUp} label="Close rate" value={connected ? closeRate : "–"} />
      </div>

      {stages.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {stages.map((s) => (
            <span key={s.stage} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border border-border bg-muted/40">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
              {s.stage} · <span className="tabular-nums font-medium">{s.count}</span>
              {s.value > 0 && <span className="text-muted-foreground tabular-nums">{currency(s.value)}</span>}
            </span>
          ))}
        </div>
      )}

      {connected && <ContactComplianceCard />}

      <CloseKeyDialog open={openDialog} onOpenChange={setOpenDialog} connected={!!connected} onChanged={refresh} />
    </div>
  );
}

/**
 * Outreach SOP compliance across the whole Close CRM: uncontacted leads,
 * today's touches, and where the "no pickup → double dial → email" chain
 * broke — per lead tier (Lead Score) and overall.
 */
function ContactComplianceCard() {
  const complianceFn = useServerFn(getCloseContactCompliance);
  const q = useQuery({
    queryKey: ["close-compliance"],
    queryFn: () => complianceFn(),
    staleTime: 4 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });
  const d = q.data;
  if (q.isLoading) return <div className="text-[11px] text-muted-foreground py-2">Sweeping the CRM for outreach compliance…</div>;
  if (!d?.configured || d.error) return null;

  const rows = [...d.tiers, d.overall];
  const cell = (n: number, danger = false, warn = false) => (
    <span className={`tabular-nums ${n === 0 ? "text-muted-foreground/50" : danger ? "text-danger-fg font-medium" : warn ? "text-warning-fg font-medium" : "text-foreground"}`}>{n}</span>
  );

  return (
    <div className="pt-3 border-t border-border space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[12px] font-medium text-foreground">Outreach compliance</div>
        <span className="text-[10px] text-muted-foreground">
          SOP: no pickup → double dial → email · {d.totalLeads} leads swept{d.truncated ? " (oldest activity truncated)" : ""}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[11px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Tier</th>
              <th className="py-1 px-2 font-medium text-right">Leads</th>
              <th className="py-1 px-2 font-medium text-right">Uncontacted</th>
              <th className="py-1 px-2 font-medium text-right">Touched today</th>
              <th className="py-1 px-2 font-medium text-right">Called once</th>
              <th className="py-1 px-2 font-medium text-right">Double-dialed</th>
              <th className="py-1 px-2 font-medium text-right" title="Dialed once, no pickup, never re-dialed">No 2nd dial</th>
              <th className="py-1 pl-2 font-medium text-right" title="Double-dialed, still no pickup, no email sent">No email after</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.tier} className={`border-t border-border/60 ${t.tier === "All" ? "bg-muted/30 font-medium" : ""}`}>
                <td className="py-1.5 pr-2">{t.tier === "All" ? "All leads" : t.tier === "Unscored" ? "Unscored" : `${t.tier}-tier`}</td>
                <td className="py-1.5 px-2 text-right tabular-nums">{t.total}</td>
                <td className="py-1.5 px-2 text-right">{cell(t.uncontacted, t.tier === "A" && t.uncontacted > 0, t.uncontacted > 0)}</td>
                <td className="py-1.5 px-2 text-right">{cell(t.contactedToday)}</td>
                <td className="py-1.5 px-2 text-right">{cell(t.calledOnce)}</td>
                <td className="py-1.5 px-2 text-right">{cell(t.doubleDialed)}</td>
                <td className="py-1.5 px-2 text-right">{cell(t.singleDialNoRetry, t.singleDialNoRetry > 0)}</td>
                <td className="py-1.5 pl-2 text-right">{cell(t.doubleDialNoEmail, t.doubleDialNoEmail > 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Icon className="h-3 w-3" /> {label}</div>
      <div className="text-[18px] font-medium tabular-nums text-foreground leading-tight">{value}</div>
    </div>
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
    } catch (e: unknown) {
      setSaving(false); setTesting(false);
      toast.error(e instanceof Error ? e.message : "Failed to save key");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Remove the stored Close API key?")) return;
    await del();
    toast.success("Close CRM disconnected");
    onChanged();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close CRM connection</DialogTitle>
          <DialogDescription>The key is stored server-side in service credentials · never in the browser.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="close-key">API key</Label>
          <Input
            id="close-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="api_..."
            autoComplete="off"
          />
          {result && (
            <p className={`text-[12px] ${result.ok ? "text-success-fg" : "text-danger-fg"}`}>{result.msg}</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          {connected && (
            <Button variant="ghost" onClick={handleDisconnect} className="mr-auto text-danger-fg hover:text-danger-fg">
              Disconnect
            </Button>
          )}
          <Button onClick={handleSaveAndTest} disabled={saving || testing || !apiKey.trim()}>
            {saving ? "Saving…" : testing ? "Testing…" : "Save & test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
