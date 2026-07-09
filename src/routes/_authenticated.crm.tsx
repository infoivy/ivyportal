import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import {
  ExternalLink, Zap, Search, Filter, DollarSign, Users, Phone, TrendingUp, CheckCircle2, Trash2,
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

const SAMPLE_PIPELINE = [
  { stage: "New Lead", count: 142, value: "$0", color: "#64748b" },
  { stage: "Qualified", count: 68, value: "$204K", color: "#3b82f6" },
  { stage: "Call Booked", count: 34, value: "$170K", color: "#a855f7" },
  { stage: "Proposal Sent", count: 18, value: "$126K", color: "#f59e0b" },
  { stage: "Closed Won", count: 9, value: "$81K", color: "#22c55e" },
];
const SAMPLE_RECENT = [
  { name: "Sarah M.", status: "Call Booked", value: "$5K", time: "2h ago", color: "#a855f7" },
  { name: "Marcus T.", status: "Qualified", value: "$3K", time: "3h ago", color: "#3b82f6" },
  { name: "Priya K.", status: "Closed Won", value: "$9K", time: "5h ago", color: "#22c55e" },
  { name: "Alex R.", status: "Proposal Sent", value: "$7K", time: "1d ago", color: "#f59e0b" },
  { name: "Jamie L.", status: "New Lead", value: "$0", time: "1d ago", color: "#64748b" },
];

type Lead = { id: string; name: string; status: string; value: number; updated_at: string };

function currency(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n}`;
}

function Crm() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const getStatus = useServerFn(getCloseStatus);
  const listLeads = useServerFn(listCloseLeads);

  const [connected, setConnected] = useState<boolean | null>(null);
  const [liveLeads, setLiveLeads] = useState<Lead[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  const refresh = async () => {
    const s = await getStatus();
    setConnected(!!s?.configured);
    if (s?.configured) {
      const r = await listLeads();
      setLiveLeads(r?.leads ?? []);
    } else {
      setLiveLeads(null);
    }
  };
  useEffect(() => { refresh(); }, []);

  const isLive = connected && liveLeads !== null;
  const leadsForDisplay = isLive && liveLeads.length > 0 ? liveLeads : null;
  const recent = leadsForDisplay
    ? leadsForDisplay.slice(0, 5).map((l) => ({
        name: l.name,
        status: l.status,
        value: currency(l.value),
        time: l.updated_at ? new Date(l.updated_at).toLocaleDateString() : "",
        color: "#a855f7",
      }))
    : SAMPLE_RECENT;

  return (
    <div className="dashboard-dark min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold">CRM Pipeline</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {connected ? "Close CRM · live" : "Close CRM sync · sample view until connected"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {connected ? (
              <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </div>
            ) : (
              <div className="text-[10px] font-semibold px-2 py-1 rounded-sm bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                Not Connected
              </div>
            )}
            {isAdmin && (
              <button
                onClick={() => setOpenDialog(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-sm bg-emerald-500 text-black hover:bg-emerald-400"
              >
                <Zap className="h-3 w-3" /> {connected ? "Manage key" : "Connect Close CRM"}
              </button>
            )}
          </div>
        </div>

        {!connected && (
          <div className="rounded-md border border-blue-500/40 bg-blue-500/5 p-3 flex items-start gap-3">
            <div className="grid h-6 w-6 place-items-center rounded-sm bg-blue-500/20 shrink-0">
              <ExternalLink className="h-3 w-3 text-blue-400" />
            </div>
            <div className="text-xs">
              <p className="font-semibold text-blue-400 mb-0.5">Ready to go live</p>
              <p className="text-muted-foreground">
                {isAdmin
                  ? "Paste your Close API key to sync real pipeline data."
                  : "Ask an admin to add the Close API key from this page."}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setOpenDialog(true)}
                  className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-sm border border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                >
                  Add Close API key
                </button>
              )}
            </div>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard icon={Users} label="Total Leads" value={leadsForDisplay ? String(leadsForDisplay.length) : "271"} color="#3b82f6" />
          <StatCard icon={Phone} label="Active Deals" value={leadsForDisplay ? String(leadsForDisplay.filter((l) => l.value > 0).length) : "52"} color="#a855f7" />
          <StatCard
            icon={DollarSign}
            label="Pipeline Value"
            value={leadsForDisplay ? currency(leadsForDisplay.reduce((a, l) => a + l.value, 0)) : "$581K"}
            color="#22c55e"
          />
          <StatCard icon={TrendingUp} label="Close Rate" value={leadsForDisplay ? "—" : "14.2%"} color="#f59e0b" />
        </div>

        {/* Pipeline (sample only) */}
        <div className="rounded-md border border-border bg-card p-3.5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Deal Pipeline</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Filter className="h-3 w-3" /> All setters
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {SAMPLE_PIPELINE.map((p) => (
              <div key={p.stage} className="rounded-sm border border-border p-3 bg-white/[0.01]">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.stage}</span>
                </div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: p.color }}>{p.count}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{p.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Search + Recent */}
        <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr]">
          <div className="rounded-md border border-border bg-card p-3.5">
            <h3 className="text-sm font-bold mb-3">Search Leads</h3>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Name, email, or phone..."
                disabled={!connected}
                className="w-full pl-8 pr-3 py-2 rounded-sm border border-border bg-white/[0.02] text-xs disabled:opacity-50"
              />
            </div>
            {!connected && <p className="text-[10px] text-muted-foreground mt-2">Search is available once Close is connected.</p>}
          </div>

          <div className="rounded-md border border-border bg-card overflow-hidden">
            <div className="p-3.5 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold">Recent Activity</h3>
              {leadsForDisplay && (
                <span className="text-[10px] uppercase tracking-wider text-emerald-400">Live from Close</span>
              )}
            </div>
            <div>
              {recent.map((r, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3.5 py-2.5 border-b border-border/50 last:border-0 hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{r.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: r.color }}>{r.status}</div>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-emerald-400">{r.value}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{r.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <CloseKeyDialog open={openDialog} onOpenChange={setOpenDialog} connected={!!connected} onChanged={refresh} />
      )}
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
            Paste your Close API key (found under Close → Settings → Developer → API Keys). Stored server-side and only used to fetch pipeline data.
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
          <p className="text-[10px] text-muted-foreground">
            Only admins can view or update this key.
          </p>
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
    <div className="rounded-md border border-border bg-card p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" style={{ color }} />
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
