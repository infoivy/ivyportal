import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, AlertTriangle, Copy, Check, ChevronDown, ChevronRight,
  TrendingUp, Users, Loader2, BarChart3, GraduationCap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales-hq")({
  head: () => ({ meta: [{ title: "Sales HQ — ISA Team" }] }),
  component: SalesHQ,
});

type SetterProfile = {
  id: string;
  display_name: string;
  setter_type: "phone" | "dm" | null;
};

type EODRow = {
  id: string;
  user_id: string;
  report_date: string;
  dials: number;
  leads_contacted: number;
  calls_booked: number;
};

type InviteRow = {
  id: string;
  email: string;
  roles: string[];
  used_at: string | null;
  created_at: string;
};

type OnboardingRow = { user_id: string; role: string; step_id: string };

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function kpiHit(eod: EODRow, setterType: "phone" | "dm" | null) {
  if (setterType === "phone") return { primary: eod.dials >= 100, sets: eod.calls_booked >= 3 };
  if (setterType === "dm") return { primary: eod.leads_contacted >= 125, sets: eod.calls_booked >= 3 };
  return { primary: false, sets: false };
}

function SalesHQ() {
  const { roles } = useAuth();
  const isAllowed = roles.includes("admin") || roles.includes("closer");

  if (!isAllowed) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border border-border bg-card rounded-sm p-8 text-center text-sm text-muted-foreground">
          Admin or closer access required.
        </div>
      </div>
    );
  }

  return <SalesHQInner />;
}

function SalesHQInner() {
  const today = isoDate(new Date());
  const yesterday = isoDate(new Date(Date.now() - 86400000));
  const thirtyDaysAgo = isoDate(new Date(Date.now() - 30 * 86400000));

  const [setters, setSetters] = useState<SetterProfile[]>([]);
  const [allProfiles, setAllProfiles] = useState<Record<string, string>>({});
  const [todayEods, setTodayEods] = useState<EODRow[]>([]);
  const [yesterdayEods, setYesterdayEods] = useState<EODRow[]>([]);
  const [recentEods, setRecentEods] = useState<EODRow[]>([]);
  const [invitations, setInvitations] = useState<InviteRow[]>([]);
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingRow[]>([]);
  const [firstEodByUser, setFirstEodByUser] = useState<Set<string>>(new Set());
  const [firstSetByUser, setFirstSetByUser] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedScorecard, setExpandedScorecard] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [profsRes, rolesRes, todayRes, yestRes, recentRes, invRes, progRes, firstEodRes, dealsRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name, setter_type, active" as any),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("eods").select("id, user_id, report_date, dials, leads_contacted, calls_booked").eq("report_date", today),
      supabase.from("eods").select("id, user_id, report_date, dials, leads_contacted, calls_booked").eq("report_date", yesterday),
      supabase.from("eods").select("id, user_id, report_date, dials, leads_contacted, calls_booked").gte("report_date", thirtyDaysAgo).order("report_date", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("invitations").select("id, email, roles, used_at, created_at"),
      supabase.from("onboarding_progress").select("user_id, role, step_id"),
      supabase.from("eods").select("user_id").order("report_date", { ascending: true }),
      supabase.from("deals").select("setter_id"),
    ]);

    const profs: any[] = profsRes.data ?? [];
    const rolesData = rolesRes.data ?? [];

    const profileNames: Record<string, string> = {};
    profs.forEach((p: any) => { profileNames[p.id] = p.display_name ?? "Unnamed"; });
    setAllProfiles(profileNames);

    // Collect setter user IDs
    const setterIds = new Set<string>(
      rolesData.filter(r => r.role === "setter").map(r => r.user_id)
    );
    const setterList: SetterProfile[] = profs
      .filter((p: any) => setterIds.has(p.id) && p.active !== false)
      .map((p: any) => ({ id: p.id, display_name: p.display_name ?? "Unnamed", setter_type: p.setter_type ?? null }));
    setSetters(setterList);

    setTodayEods((todayRes.data ?? []) as EODRow[]);
    setYesterdayEods((yestRes.data ?? []) as EODRow[]);
    setRecentEods((recentRes.data ?? []) as EODRow[]);
    setInvitations((invRes.data ?? []) as InviteRow[]);
    setOnboardingProgress((progRes.data ?? []) as OnboardingRow[]);

    // First EOD per user
    const seen = new Set<string>();
    const firstEods = new Set<string>();
    for (const r of (firstEodRes.data ?? []) as any[]) {
      if (!seen.has(r.user_id)) { seen.add(r.user_id); firstEods.add(r.user_id); }
    }
    setFirstEodByUser(firstEods);

    // First set per user (deal with setter_id)
    const setterDealIds = new Set<string>(
      ((dealsRes.data ?? []) as any[]).filter(d => d.setter_id).map((d: any) => d.setter_id)
    );
    setFirstSetByUser(setterDealIds);

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Maps for quick lookup
  const todayByUser = useMemo(() => {
    const m = new Map<string, EODRow>();
    todayEods.forEach(e => m.set(e.user_id, e));
    return m;
  }, [todayEods]);

  const yesterdayByUser = useMemo(() => {
    const m = new Map<string, EODRow>();
    yesterdayEods.forEach(e => m.set(e.user_id, e));
    return m;
  }, [yesterdayEods]);

  const missedYesterday = useMemo(() =>
    setters.filter(s => !yesterdayByUser.has(s.id)),
    [setters, yesterdayByUser]
  );

  const copyNudge = (setter: SetterProfile) => {
    const msg = `Hey ${setter.display_name.split(" ")[0]}, no EOD logged yesterday. Please submit today's report before EOD. 🙏`;
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedId(setter.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Nudge copied to clipboard");
    });
  };

  if (loading) {
    return (
      <div className="dashboard-dark min-h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="dashboard-dark min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-5 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Abu Bilal</div>
          <h1 className="text-lg font-bold">Sales HQ</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Team compliance, pipeline, and setter performance.</p>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatChip label="Active setters" value={setters.length} />
          <StatChip label="Filed today" value={setters.filter(s => todayByUser.has(s.id)).length} accent="green" />
          <StatChip label="Missed yesterday" value={missedYesterday.length} accent={missedYesterday.length > 0 ? "red" : "green"} />
          <StatChip label="7-day avg. sets/day" value={sevenDayAvgSets(setters, recentEods)} />
        </div>

        <Tabs defaultValue="today" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
            <TabsTrigger value="pipeline" className="text-xs">Pipeline</TabsTrigger>
            <TabsTrigger value="scorecards" className="text-xs">Scorecards</TabsTrigger>
          </TabsList>

          {/* ─── TODAY TAB ──────────────────────────────────────── */}
          <TabsContent value="today" className="space-y-4">
            {/* Today's status grid */}
            <section className="space-y-2">
              <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Today's submission status</h2>
              {setters.length === 0 ? (
                <EmptyCard msg="No active setters yet." />
              ) : (
                <div className="rounded-sm border border-border bg-card overflow-hidden">
                  {setters.map(s => {
                    const eod = todayByUser.get(s.id);
                    const submitted = !!eod;
                    const hit = eod ? kpiHit(eod, s.setter_type) : null;
                    const primaryLabel = s.setter_type === "phone" ? "dials" : s.setter_type === "dm" ? "leads" : "primary KPI";
                    const primaryVal = eod ? (s.setter_type === "phone" ? eod.dials : eod.leads_contacted) : null;
                    const primaryTarget = s.setter_type === "phone" ? 100 : s.setter_type === "dm" ? 125 : null;
                    return (
                      <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 border-b border-accent last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-7 w-7 rounded-sm bg-accent border border-border flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                            {s.display_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{s.display_name}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              {s.setter_type ? (s.setter_type === "phone" ? "Phone · 100 dials" : "DM · 125 leads") : "Type not set"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {submitted ? (
                            <>
                              {hit && primaryTarget !== null && primaryVal !== null && (
                                <span className={`text-[11px] px-2 py-0.5 rounded-sm border ${
                                  hit.primary
                                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                }`}>
                                  {primaryVal}/{primaryTarget} {primaryLabel}
                                </span>
                              )}
                              {hit && (
                                <span className={`text-[11px] px-2 py-0.5 rounded-sm border ${
                                  hit.sets
                                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                                    : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                }`}>
                                  {eod?.calls_booked}/3 sets
                                </span>
                              )}
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            </>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded-sm">
                              <XCircle className="h-3.5 w-3.5" /> Missing
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Missed yesterday nudge */}
            {missedYesterday.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-amber-400" /> Missed yesterday — send nudge
                </h2>
                <div className="rounded-sm border border-amber-500/20 bg-card overflow-hidden">
                  {missedYesterday.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-accent last:border-0">
                      <div className="text-sm font-medium">{s.display_name}</div>
                      <button
                        onClick={() => copyNudge(s)}
                        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-sm border border-border text-muted-foreground hover:text-foreground hover:border-amber-500/40 transition"
                      >
                        {copiedId === s.id ? <><Check className="h-3.5 w-3.5 text-green-400" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy nudge</>}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Copies a WhatsApp-ready message for each missed setter.</p>
              </section>
            )}

            {missedYesterday.length === 0 && setters.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-green-400 border border-green-500/20 bg-green-500/5 rounded-sm px-4 py-3">
                <CheckCircle2 className="h-4 w-4" /> All setters filed yesterday. No nudges needed.
              </div>
            )}
          </TabsContent>

          {/* ─── PIPELINE TAB ───────────────────────────────────── */}
          <TabsContent value="pipeline" className="space-y-3">
            <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Setter onboarding pipeline</h2>
            <PipelineTab
              setters={setters}
              invitations={invitations}
              onboardingProgress={onboardingProgress}
              firstEodByUser={firstEodByUser}
              firstSetByUser={firstSetByUser}
            />
          </TabsContent>

          {/* ─── SCORECARDS TAB ─────────────────────────────────── */}
          <TabsContent value="scorecards" className="space-y-3">
            <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Setter scorecards — last 30 days</h2>
            {setters.length === 0 ? (
              <EmptyCard msg="No active setters." />
            ) : (
              <div className="space-y-2">
                {setters.map(s => (
                  <ScorecardRow
                    key={s.id}
                    setter={s}
                    eods={recentEods.filter(e => e.user_id === s.id)}
                    expanded={expandedScorecard === s.id}
                    onToggle={() => setExpandedScorecard(prev => prev === s.id ? null : s.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── PIPELINE TAB COMPONENT ─────────────────────────────────────────────────

const STAGES = ["Invited", "Signed up", "SOPs read", "First EOD", "First set", "Ramped"] as const;
type Stage = typeof STAGES[number];

function getStage(
  setter: SetterProfile,
  invitations: InviteRow[],
  onboardingProgress: OnboardingRow[],
  firstEodByUser: Set<string>,
  firstSetByUser: Set<string>,
): Stage {
  // Check onboarding % for setter role
  const setterSteps = onboardingProgress.filter(p => p.user_id === setter.id && p.role === "setter");
  const pct = setterSteps.length; // crude proxy; ≥1 step means SOPs started

  if (firstSetByUser.has(setter.id) && pct >= 3) return "Ramped";
  if (firstSetByUser.has(setter.id)) return "First set";
  if (firstEodByUser.has(setter.id)) return "First EOD";
  if (pct > 0) return "SOPs read";
  // Signed up = profile exists (they're in setters list)
  return "Signed up";
}

function PipelineTab({
  setters, invitations, onboardingProgress, firstEodByUser, firstSetByUser,
}: {
  setters: SetterProfile[];
  invitations: InviteRow[];
  onboardingProgress: OnboardingRow[];
  firstEodByUser: Set<string>;
  firstSetByUser: Set<string>;
}) {
  // Pending invitations (not yet signed up)
  const pendingInvites = invitations.filter(inv =>
    inv.roles.includes("setter") && !inv.used_at &&
    !setters.some(() => false) // all setters are signed up; this shows unused invites
  );

  const byStage: Record<Stage, (SetterProfile | InviteRow)[]> = {
    "Invited": pendingInvites,
    "Signed up": [],
    "SOPs read": [],
    "First EOD": [],
    "First set": [],
    "Ramped": [],
  };

  for (const s of setters) {
    const stage = getStage(s, invitations, onboardingProgress, firstEodByUser, firstSetByUser);
    byStage[stage].push(s);
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {STAGES.map((stage, i) => {
        const items = byStage[stage];
        const isLast = i === STAGES.length - 1;
        return (
          <div key={stage} className={`rounded-sm border bg-card p-3 space-y-2 ${isLast ? "border-green-500/30 bg-green-500/5" : "border-border"}`}>
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${isLast ? "text-green-400" : "text-muted-foreground"}`}>
              {stage}
              <span className="ml-1.5 text-foreground">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="text-[10px] text-muted-foreground/50 italic">—</div>
            ) : (
              items.map((item) => {
                const isProfile = "setter_type" in item;
                const name = isProfile ? (item as SetterProfile).display_name : (item as InviteRow).email;
                return (
                  <div key={isProfile ? (item as SetterProfile).id : (item as InviteRow).id}
                    className="text-xs px-2 py-1.5 rounded-sm bg-accent border border-border truncate" title={name}>
                    {name}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SCORECARD ROW ──────────────────────────────────────────────────────────

function ScorecardRow({ setter, eods, expanded, onToggle }: {
  setter: SetterProfile;
  eods: EODRow[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const totalDays = eods.length;
  if (totalDays === 0) {
    return (
      <div className="rounded-sm border border-border bg-card px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium">{setter.display_name}</span>
        <span className="text-xs text-muted-foreground">No EODs in last 30 days</span>
      </div>
    );
  }

  const primaryHits = eods.filter(e => kpiHit(e, setter.setter_type).primary).length;
  const setsHits = eods.filter(e => kpiHit(e, setter.setter_type).sets).length;
  const primaryRate = Math.round((primaryHits / totalDays) * 100);
  const setsRate = Math.round((setsHits / totalDays) * 100);
  const avgSets = (eods.reduce((s, e) => s + e.calls_booked, 0) / totalDays).toFixed(1);
  const primaryKey = setter.setter_type === "phone" ? "dials" : "leads_contacted";
  const avgPrimary = (eods.reduce((s, e) => s + (e as any)[primaryKey], 0) / totalDays).toFixed(0);

  return (
    <div className="rounded-sm border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/50 transition"
      >
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-sm bg-accent border border-border flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
            {setter.display_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium">{setter.display_name}</div>
            <div className="text-[10px] text-muted-foreground">{totalDays} days tracked</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <RatePill label={setter.setter_type === "phone" ? "Dials hit" : "Leads hit"} pct={primaryRate} />
          <RatePill label="Sets hit" pct={setsRate} />
          <span className="text-[11px] text-muted-foreground hidden sm:block">avg {avgSets} sets/day · avg {avgPrimary} {setter.setter_type === "phone" ? "dials" : "leads"}/day</span>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Last 7 days</h3>
          <div className="flex gap-1 flex-wrap">
            {eods.slice(0, 7).map(e => {
              const hit = kpiHit(e, setter.setter_type);
              const bothHit = hit.primary && hit.sets;
              const oneHit = hit.primary || hit.sets;
              return (
                <div key={e.id} className={`rounded-sm px-2 py-1.5 text-[10px] border ${
                  bothHit ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : oneHit ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-red-500/20 bg-red-500/5 text-red-400"
                }`}>
                  {e.report_date.slice(5)} · {setter.setter_type === "phone" ? e.dials : e.leads_contacted} {setter.setter_type === "phone" ? "dials" : "leads"} · {e.calls_booked} sets
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <MiniStat label="Primary KPI hit%" value={`${primaryRate}%`} />
            <MiniStat label="Sets KPI hit%" value={`${setsRate}%`} />
            <MiniStat label="Avg sets/day" value={avgSets} />
            <MiniStat label={`Avg ${setter.setter_type === "phone" ? "dials" : "leads"}/day`} value={avgPrimary} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HELPER COMPONENTS ──────────────────────────────────────────────────────

function StatChip({ label, value, accent }: { label: string; value: number | string; accent?: "green" | "red" }) {
  const color = accent === "green" ? "text-green-400" : accent === "red" ? "text-red-400" : "text-foreground";
  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function RatePill({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 80 ? "text-green-400 border-green-500/30 bg-green-500/10"
    : pct >= 50 ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
    : "text-red-400 border-red-500/20 bg-red-500/5";
  return (
    <div className={`hidden sm:flex flex-col items-center text-[10px] border rounded-sm px-2 py-1 ${color}`}>
      <span className="font-semibold">{pct}%</span>
      <span className="text-[9px] opacity-80">{label}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border bg-accent/50 p-2">
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function EmptyCard({ msg }: { msg: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-card/50 p-8 text-center text-xs text-muted-foreground">
      {msg}
    </div>
  );
}

function sevenDayAvgSets(setters: SetterProfile[], recentEods: EODRow[]): string {
  const sevenDaysAgo = isoDate(new Date(Date.now() - 7 * 86400000));
  const last7 = recentEods.filter(e =>
    e.report_date >= sevenDaysAgo &&
    setters.some(s => s.id === e.user_id)
  );
  if (last7.length === 0) return "—";
  const totalSets = last7.reduce((s, e) => s + e.calls_booked, 0);
  return (totalSets / last7.length).toFixed(1);
}
