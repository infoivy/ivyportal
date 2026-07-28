import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RevenueTabBar } from "@/components/revenue-tab-bar";
import { SelectField } from "@/components/ui/select-field";
import { toast } from "sonner";
import { todayBiz } from "@/lib/dates";
import {
  CheckCircle2, XCircle, AlertTriangle, Copy, Check, Loader2,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { BreakdownBar } from "@/components/ui/breakdown-bar";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales · ISA Team" }] }),
  component: Sales,
});

type SetterProfile = { id: string; display_name: string; setter_type: "phone" | "dm" | "full_cycle" | null };
type EODRow = { id: string; user_id: string; report_date: string; dials: number; leads_contacted: number; dms_sent: number; calls_booked: number };
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function kpiHit(eod: EODRow, setterType: "phone" | "dm" | "full_cycle" | null) {
  // "DMs sent" absorbed leads_contacted (2026-07-11) — read the max of both
  const outreach = Math.max(eod.dms_sent ?? 0, eod.leads_contacted ?? 0);
  const sets = eod.calls_booked >= 3;
  let primary = false;
  if (setterType === "phone") primary = eod.dials >= 100;
  else if (setterType === "dm") primary = outreach >= 125;
  else if (setterType === "full_cycle") primary = eod.dials >= 100 && outreach >= 50;
  // Founder rule 2026-07-14: 3+ sets = KPI met on its own; volume is the fallback
  return { primary, sets, met: sets || primary };
}

function Sales() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const isAllowed = roles.includes("admin") || roles.includes("closer");
  const canRevenue = roles.includes("coach") || roles.includes("founder");
  useEffect(() => {
    // The Sales section is one sidebar entry — coaches/founders own the
    // Revenue tab of it, not closer operations.
    if (!isAllowed && canRevenue) navigate({ to: "/revenue", replace: true });
  }, [isAllowed, canRevenue, navigate]);
  if (!isAllowed) {
    if (canRevenue) return null;
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="card-surface p-8 text-center text-[13px] text-muted-foreground">
          Admin or closer access required.
        </div>
      </div>
    );
  }
  return <SalesInner />;
}

function SalesInner() {
  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-5 space-y-5">
      <RevenueTabBar />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display text-foreground">Activity</h1>
          <p className="text-body text-muted-foreground mt-1">Today's setter compliance, missing reports, and nudge queue.</p>
        </div>
      </div>

      <OperationsTab />
    </div>
  );
}

// ─── OPERATIONS TAB ─────────────────────────────────────────────────────────

function OperationsTab() {
  const today = todayBiz();
  const yesterday = isoDate(new Date(Date.now() - 86400000));

  const [setters, setSetters] = useState<SetterProfile[]>([]);
  const [todayEods, setTodayEods] = useState<EODRow[]>([]);
  const [yesterdayEods, setYesterdayEods] = useState<EODRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { roles } = useAuth();
  const canEditSetterType = roles.includes("admin");

  const fetchPage = async () => {
    const [profsRes, rolesRes, todayRes, yestRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name, setter_type, active" as any).eq("is_demo", false),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("eods").select("id, user_id, report_date, dials, leads_contacted, dms_sent, calls_booked").eq("is_demo", false).eq("report_date", today),
      supabase.from("eods").select("id, user_id, report_date, dials, leads_contacted, dms_sent, calls_booked").eq("is_demo", false).eq("report_date", yesterday),
    ]);

    const profs: any[] = profsRes.data ?? [];
    const rolesData = rolesRes.data ?? [];
    const setterIds = new Set<string>(rolesData.filter(r => r.role === "setter").map(r => r.user_id));
    const setterList: SetterProfile[] = profs
      .filter((p: any) => setterIds.has(p.id) && p.active !== false)
      .map((p: any) => ({ id: p.id, display_name: p.display_name ?? "Unnamed", setter_type: p.setter_type ?? null }));

    return {
      setterList,
      today: (todayRes.data ?? []) as EODRow[],
      yesterday: (yestRes.data ?? []) as EODRow[],
    };
  };

  const pageQ = useQuery({ queryKey: ["page", "sales", "ops", today], queryFn: fetchPage });
  useEffect(() => {
    if (!pageQ.data) return;
    setSetters(pageQ.data.setterList);
    setTodayEods(pageQ.data.today);
    setYesterdayEods(pageQ.data.yesterday);
    setLoading(false);
  }, [pageQ.data]);

  const todayByUser = useMemo(() => { const m = new Map<string, EODRow>(); todayEods.forEach(e => m.set(e.user_id, e)); return m; }, [todayEods]);
  const yesterdayByUser = useMemo(() => { const m = new Map<string, EODRow>(); yesterdayEods.forEach(e => m.set(e.user_id, e)); return m; }, [yesterdayEods]);
  const missedYesterday = useMemo(() => setters.filter(s => !yesterdayByUser.has(s.id)), [setters, yesterdayByUser]);

  const updateSetterType = async (id: string, type: "phone" | "dm" | "full_cycle") => {
    const { error } = await (supabase as any).from("profiles").update({ setter_type: type }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setSetters(prev => prev.map(s => s.id === id ? { ...s, setter_type: type } : s));
    toast.success("Setter type updated");
  };

  const copyNudge = (setter: SetterProfile) => {
    const msg = `Hey ${setter.display_name.split(" ")[0]}, no EOD logged yesterday. Please submit today's report before EOD. 🙏`;
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedId(setter.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Nudge copied to clipboard");
    });
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const filedToday = setters.filter(s => todayByUser.has(s.id));
  const filedAndHit = filedToday.filter(s => kpiHit(todayByUser.get(s.id)!, s.setter_type).met);
  const filedOnly = filedToday.length - filedAndHit.length;
  const missing = setters.length - filedToday.length;


  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <StatCard label="Active setters" value={setters.length} noData={setters.length === 0} />
        <StatCard label="Filed today" value={filedToday.length} accent noData={setters.length === 0} />
        <StatCard label="Missed yesterday" value={missedYesterday.length} hint={missedYesterday.length > 0 ? "needs nudge" : "all filed"} noData={setters.length === 0} />
      </div>

      <div className="card-surface p-4">
        <BreakdownBar segments={[
          { label: "KPI hit", value: filedAndHit.length, color: "var(--foreground)" },
          { label: "Submitted", value: filedOnly, color: "var(--muted-foreground)" },
          { label: "Missing", value: missing, color: "var(--destructive)" },
        ]} title="Today's compliance" />
      </div>

      {/* Today */}
      <section className="space-y-3">
        <h2 className="text-title text-foreground">Today's submission status</h2>
        <div className="space-y-4">
          {setters.length === 0 ? (
            <EmptySales msg="No active setters yet." />
          ) : (
            <div className="card-surface overflow-hidden">
              {setters.map(s => {
                const eod = todayByUser.get(s.id);
                const submitted = !!eod;
                const hit = eod ? kpiHit(eod, s.setter_type) : null;
                const primaryLabel = s.setter_type === "phone" ? "dials" : s.setter_type === "dm" ? "leads" : "primary KPI";
                const primaryVal = eod ? (s.setter_type === "phone" ? eod.dials : eod.leads_contacted) : null;
                const primaryTarget = s.setter_type === "phone" ? 100 : s.setter_type === "dm" ? 125 : null;
                return (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                        {s.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[14px] font-medium">{s.display_name}</div>
                        {s.setter_type ? (
                          <div className="text-[12px] text-muted-foreground">
                            {s.setter_type === "phone" ? "Phone · 100 dials" : s.setter_type === "full_cycle" ? "Full cycle · 100 dials + 50 DMs" : "DM · 125 DMs"}
                          </div>
                        ) : canEditSetterType ? (
                          <span onClick={e => e.stopPropagation()}>
                            <SelectField
                              value=""
                              onChange={(v) => { if (v) updateSetterType(s.id, v as "phone" | "dm" | "full_cycle"); }}
                              placeholder="Set type…"
                              className="h-5 w-24 text-[11px] bg-warning-bg text-warning-fg border-warning/25"
                              options={[
                                { value: "phone", label: "Phone" },
                                { value: "dm", label: "DM" },
                                { value: "full_cycle", label: "Full cycle" },
                              ]}
                            />
                          </span>
                        ) : (
                          <div className="text-[12px] text-warning-fg">Type not set</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {submitted ? (
                        <>
                          {hit && primaryTarget !== null && primaryVal !== null && (
                            <span className={`text-[12px] px-2 py-0.5 rounded-full ${hit.primary ? "bg-primary/10 text-primary" : "bg-warning-bg text-warning-fg"}`}>
                              {primaryVal}/{primaryTarget} {primaryLabel}
                            </span>
                          )}
                          {hit && (
                            <span className={`text-[12px] px-2 py-0.5 rounded-full ${hit.sets ? "bg-primary/10 text-primary" : "bg-warning-bg text-warning-fg"}`}>
                              {eod?.calls_booked}/3 sets
                            </span>
                          )}
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        </>
                      ) : (
                        <span className="flex items-center gap-1 text-[12px] text-danger-fg dark:text-danger-fg bg-danger-bg px-2 py-0.5 rounded-full">
                          <XCircle className="h-3.5 w-3.5" /> Missing
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {missedYesterday.length > 0 && (
            <div className="space-y-2">
              <div className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-warning-fg" /> Missed yesterday · send nudge
              </div>
              <div className="card-surface overflow-hidden">
                {missedYesterday.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-0">
                    <div className="text-[14px] font-medium">{s.display_name}</div>
                    <button
                      onClick={() => copyNudge(s)}
                      className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md bg-muted text-muted-foreground hover:text-foreground motion-safe:transition-colors"
                    >
                      {copiedId === s.id ? <><Check className="h-3.5 w-3.5 text-primary" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy nudge</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {missedYesterday.length === 0 && setters.length > 0 && (
            <div className="flex items-center gap-2 text-[13px] text-primary card-surface px-4 py-3">
              <CheckCircle2 className="h-4 w-4" /> All setters filed yesterday. No nudges needed.
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

function EmptySales({ msg }: { msg: string }) {
  return <div className="card-surface border-dashed p-8 text-center text-[13px] text-muted-foreground">{msg}</div>;
}
