import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CommissionRates, DEFAULT_RATES } from "@/lib/revenue";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Shield, CheckCircle2, Users, Mail, UserX, Star,
  ArrowUpRight, ClipboardList, Percent, Save, Database, ExternalLink, History,
  Circle, Rocket,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Console — ISA" }] }),
  component: AdminConsole,
});

type EodRow = { id: string; user_id: string; report_date: string };
type Profile = { id: string; display_name: string | null };
type UserRole = { user_id: string; role: string };
type Student = {
  id: string; full_name: string; email: string | null; coach_id: string | null; status: string;
  first_win_at: string | null; testimonial_collected: boolean; trustpilot_collected: boolean;
};
type CallRow = { id: string; student_id: string; call_date: string; coach_id: string | null; progress_rating: number | null };

const RANGES = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
] as const;
type RangeKey = typeof RANGES[number]["key"];

function AdminConsole() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [range, setRange] = useState<RangeKey>("30d");
  const [eods, setEods] = useState<EodRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [unratedCalls, setUnratedCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateRows, setRateRows] = useState<{ id: string; key: string; label: string; rate: number; active: boolean }[]>([]);
  const [crmEnabled, setCrmEnabled] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState<string>("");
  const [founderSettingsId, setFounderSettingsId] = useState<string | null>(null);
  const [qGoals, setQGoals] = useState<Record<string, string>>({ dms: "", convos: "", calls: "", shows: "", showRate: "", viral: "" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [auditLog, setAuditLog] = useState<{ id: string; action: string; table_name: string; record_id: string | null; created_at: string; user_id: string | null }[]>([]);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const days = RANGES.find(r => r.key === range)!.days;

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    const from = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
    (async () => {
      const [eodRes, profRes, roleRes, studRes, callsRes, ratesRes, fsRes, auditRes] = await Promise.all([
        supabase.from("eods").select("id, user_id, report_date").gte("report_date", from),
        supabase.from("profiles").select("id, display_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("students").select("id, full_name, email, coach_id, status, first_win_at, testimonial_collected, trustpilot_collected"),
        supabase.from("student_calls").select("id, student_id, call_date, coach_id, progress_rating").eq("status", "completed").is("progress_rating", null).order("call_date", { ascending: false }).limit(50),
        supabase.from("commission_rates").select("*").eq("active", true),
        supabase.from("founder_settings").select("id, crm_enabled, monthly_cash_goal, quarterly_goals").maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("audit_log").select("id, action, table_name, record_id, created_at, user_id").order("created_at", { ascending: false }).limit(100),
      ]);
      setEods((eodRes.data as EodRow[]) ?? []);
      const pmap: Record<string, Profile> = {};
      (profRes.data as Profile[] | null)?.forEach(p => { pmap[p.id] = p; });
      setProfiles(pmap);
      setUserRoles((roleRes.data as UserRole[]) ?? []);
      setStudents((studRes.data as Student[]) ?? []);
      setUnratedCalls((callsRes.data as CallRow[]) ?? []);
      const rows = (ratesRes.data ?? []).map(r => ({ id: r.id, key: r.key, label: r.label, rate: Number(r.rate), active: r.active }));
      setRateRows(rows);
      if (fsRes.data) {
        const fs = fsRes.data as any;
        setFounderSettingsId(fs.id);
        setCrmEnabled(!!fs.crm_enabled);
        setMonthlyGoal(fs.monthly_cash_goal ? String(fs.monthly_cash_goal) : "");
        const qg = (fs as { quarterly_goals?: Record<string, number> }).quarterly_goals;
        if (qg) setQGoals(Object.fromEntries(Object.entries(qg).map(([k, v]) => [k, String(v)])));
      }
      setAuditLog((auditRes.data ?? []) as any[]);

      // Go-live checklist signals (fire-and-forget queries)
      const now = new Date();
      const sb = supabase as any;
      const [plRes, ccRes, igRes, demoEodRes, demoStudentRes] = await Promise.all([
        sb.from("payment_links").select("id", { count: "exact", head: true }),
        sb.from("calendar_connections").select("id", { count: "exact", head: true }),
        sb.from("ig_monthly_snapshots").select("id").eq("year", now.getFullYear()).eq("month", now.getMonth() + 1).maybeSingle(),
        sb.from("eods").select("id", { count: "exact", head: true }).eq("is_demo", true),
        sb.from("students").select("id", { count: "exact", head: true }).eq("is_demo", true),
      ]);
      const setterProfiles = (roleRes.data ?? []).filter(r => r.role === "setter").map(r => r.user_id);
      const adminCount = (roleRes.data ?? []).filter(r => r.role === "admin").length;
      const commissionOk = (ratesRes.data ?? []).some(r => r.key === "set_close" && r.active) &&
                           (ratesRes.data ?? []).some(r => r.key === "new_close" && r.active);
      const allSettersHaveType = setterProfiles.every(uid => {
        const p = (profRes.data as Profile[] | null)?.find(p => p.id === uid);
        return p && (p as any).setter_type;
      });
      setChecklist({
        paymentLinks: (plRes.count ?? 0) > 0,
        commissionConfirmed: commissionOk,
        cashGoalSet: !!(fsRes.data as any)?.monthly_cash_goal,
        setterTypesSet: allSettersHaveType,
        teamInvited: adminCount >= 2,
        calendarConnected: (ccRes.count ?? 0) > 0,
        igLogged: !!igRes.data,
        demoRemoved: (demoEodRes.count ?? 0) === 0 && (demoStudentRes.count ?? 0) === 0,
      });

      setLoading(false);
    })();
  }, [days, isAdmin]);

  const compliance = useMemo(() => buildCompliance(eods, userRoles, profiles, days), [eods, userRoles, profiles, days]);

  const activeStudents = useMemo(() => students.filter(s => s.status === "active"), [students]);
  const studentsWithoutEmail = useMemo(() => activeStudents.filter(s => !s.email || !s.email.trim()), [activeStudents]);
  const studentsWithoutCoach = useMemo(() => activeStudents.filter(s => !s.coach_id), [activeStudents]);
  const testimonialsPending = useMemo(
    () => activeStudents.filter(s => s.first_win_at && (!s.testimonial_collected || !s.trustpilot_collected)),
    [activeStudents]
  );

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const ur of userRoles) c[ur.role] = (c[ur.role] ?? 0) + 1;
    return c;
  }, [userRoles]);

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="border border-danger/25 bg-danger-bg rounded-sm p-8 text-center">
          <Shield className="h-8 w-8 text-danger-fg mx-auto mb-3" />
          <div className="text-sm text-danger-fg font-medium">Admin access required</div>
          <p className="text-xs text-muted-foreground mt-1">You need the admin role to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-display text-foreground">Admin</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Team health & administration</p>
        </div>
        <div className="inline-flex rounded-lg bg-muted p-[3px]">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-[8px] leading-none motion-safe:transition-colors ${
                range === r.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {/* Go-live checklist */}
      <GoLiveChecklist checklist={checklist} />

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <Tile label="Team members" value={Object.keys(profiles).length} icon={<Users className="h-3 w-3" />} />
        <Tile label="Admins" value={roleCounts["admin"] ?? 0} icon={<Shield className="h-3 w-3" />} />
        <Tile label="Unrated completed calls" value={unratedCalls.length} icon={<ClipboardList className="h-3 w-3" />} tone={unratedCalls.length > 0 ? "amber" : "muted"} />
        <Tile label="Students · no email" value={studentsWithoutEmail.length} icon={<Mail className="h-3 w-3" />} tone={studentsWithoutEmail.length > 0 ? "amber" : "muted"} />
        <Tile label="Students · no coach" value={studentsWithoutCoach.length} icon={<UserX className="h-3 w-3" />} tone={studentsWithoutCoach.length > 0 ? "rose" : "muted"} />
        <Tile label="Testimonials pending" value={testimonialsPending.length} icon={<Star className="h-3 w-3" />} tone={testimonialsPending.length > 0 ? "amber" : "muted"} />
      </div>

      {/* Role management gateway */}
      <Panel
        title="Role management"
        subtitle="Grant, revoke, deactivate or delete member accounts"
        action={<Link to="/team" className="text-[11px] px-2.5 py-1 rounded-sm border border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Open Team <ArrowUpRight className="h-3 w-3" /></Link>}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {["admin", "coach", "setter", "closer", "csm", "student"].map(r => (
            <div key={r} className="card-surface p-2.5">
              <div className="text-[12px] text-muted-foreground">{r}</div>
              <div className="text-[20px] font-semibold tabular-nums mt-0.5">{roleCounts[r] ?? 0}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Two-column: EOD compliance + Unrated calls */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="EOD compliance"
          subtitle={`Reports submitted in last ${days} days`}
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-success-fg" />}
        >
          <div className="divide-y divide-[var(--accent)]">
            {compliance.length === 0 && !loading && <Empty text="No team members yet." />}
            {compliance.map(c => (
              <div key={c.userId} className="flex items-center gap-3 py-2.5">
                <div className="h-7 w-7 rounded-sm bg-[var(--accent)] border border-[var(--border)] flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground">{c.role}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-[var(--accent)] overflow-hidden">
                    <div
                      className={`h-full ${c.rate >= 80 ? "bg-success" : c.rate >= 50 ? "bg-warning" : "bg-danger"}`}
                      style={{ width: `${c.rate}%` }}
                    />
                  </div>
                  <div className={`text-xs w-14 text-right ${c.rate >= 80 ? "text-success-fg" : c.rate >= 50 ? "text-warning-fg" : "text-danger-fg"}`}>
                    {c.submitted}/{days}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Unrated completed calls"
          subtitle="Coaches need to add a 1–5 progress rating"
          icon={<ClipboardList className="h-3.5 w-3.5 text-warning-fg" />}
          action={<Link to="/calls" className="text-[11px] px-2.5 py-1 rounded-sm border border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Open Calls <ArrowUpRight className="h-3 w-3" /></Link>}
        >
          <div className="divide-y divide-[var(--accent)]">
            {unratedCalls.length === 0 && !loading && <Empty text="All completed calls are rated. 🎉" />}
            {unratedCalls.slice(0, 12).map(c => {
              const student = students.find(s => s.id === c.student_id);
              const coach = c.coach_id ? profiles[c.coach_id]?.display_name : null;
              return (
                <div key={c.id} className="grid grid-cols-[80px_1fr_1fr] gap-3 py-2.5 text-xs items-center">
                  <span className="text-muted-foreground">{c.call_date}</span>
                  <span className="truncate">{student?.full_name ?? "Unknown student"}</span>
                  <span className="truncate text-muted-foreground">{coach ?? "—"}</span>
                </div>
              );
            })}
            {unratedCalls.length > 12 && (
              <div className="pt-2 text-[11px] text-muted-foreground text-center">
                +{unratedCalls.length - 12} more
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Commission rates — moved from Revenue page */}
      <div id="commission">
        <CommissionRatesCard rows={rateRows} reload={() => {
          supabase.from("commission_rates").select("*").eq("active", true).then(({ data }) => {
            if (data) setRateRows(data.map(r => ({ id: r.id, key: r.key, label: r.label, rate: Number(r.rate), active: r.active })));
          });
        }} />
      </div>

      {/* Portal settings */}
      <Panel title="Portal settings" icon={<Shield className="h-3.5 w-3.5 text-muted-foreground" />}>
        <div className="space-y-4">
          {/* Monthly cash goal */}
          <div className="space-y-1">
            <Label className="text-xs">Monthly cash goal (USD)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={monthlyGoal}
                onChange={e => setMonthlyGoal(e.target.value)}
                placeholder="e.g. 50000"
                className="w-40 h-8 text-xs"
              />
              <Button
                size="sm"
                disabled={savingSettings}
                onClick={async () => {
                  setSavingSettings(true);
                  const goal = Number(monthlyGoal) || null;
                  if (founderSettingsId) {
                    const { error } = await supabase.from("founder_settings").update({ monthly_cash_goal: goal } as any).eq("id", founderSettingsId);
                    if (error) toast.error(error.message); else toast.success("Goal saved");
                  }
                  setSavingSettings(false);
                }}
              >
                <Save className="h-3.5 w-3.5 mr-1" /> Save goal
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Shown on the Founder HQ command view progress bar.</p>
          </div>

          {/* Quarterly team goals */}
          <div className="space-y-2 py-3 border-t border-border">
            <Label className="text-xs">Quarterly team goals</Label>
            <p className="text-[10px] text-muted-foreground">Drives the goals panel on the dashboard (admin/founder only see it).</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {([
                ["dms", "DMs sent"], ["convos", "Convos"], ["calls", "Calls booked"],
                ["shows", "Shows"], ["showRate", "Show rate %"], ["viral", "Viral posts"],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <Input
                    type="number"
                    value={qGoals[key] ?? ""}
                    onChange={e => setQGoals(g => ({ ...g, [key]: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
            <Button
              size="sm"
              disabled={savingSettings}
              onClick={async () => {
                if (!founderSettingsId) return;
                setSavingSettings(true);
                const payload = Object.fromEntries(
                  Object.entries(qGoals).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])
                );
                const { error } = await supabase.from("founder_settings")
                  .update({ quarterly_goals: payload } as never).eq("id", founderSettingsId);
                if (error) toast.error(error.message); else toast.success("Quarterly goals saved");
                setSavingSettings(false);
              }}
            >
              <Save className="h-3.5 w-3.5 mr-1" /> Save goals
            </Button>
          </div>

          {/* CRM toggle */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div>
              <div className="text-xs font-medium flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-muted-foreground" /> CRM Integration</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Enable the CRM sidebar link and /crm route. Disable if Close CRM is not connected.</p>
            </div>
            <button
              onClick={async () => {
                const next = !crmEnabled;
                setCrmEnabled(next);
                if (founderSettingsId) {
                  const { error } = await supabase.from("founder_settings").update({ crm_enabled: next } as any).eq("id", founderSettingsId);
                  if (error) { toast.error(error.message); setCrmEnabled(!next); }
                  else toast.success(next ? "CRM enabled" : "CRM disabled");
                }
              }}
              className={`relative h-5 w-9 rounded-full transition-colors ${crmEnabled ? "bg-success" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${crmEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Backups note */}
          <div className="flex items-start gap-3 py-3 border-t border-border">
            <CheckCircle2 className="h-4 w-4 text-warning-fg mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-medium">Database backups</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Enable daily point-in-time backups in Supabase dashboard → Settings → Backups. Requires Pro tier. Do this now if not already done.
              </p>
              <a
                href="https://supabase.com/docs/guides/platform/backups"
                target="_blank"
                rel="noopener"
                className="text-[10px] text-success-fg hover:text-success-fg flex items-center gap-0.5 mt-1"
              >
                Supabase backup docs <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>

          {/* Email digest note */}
          <div className="flex items-start gap-3 py-3 border-t border-border">
            <CheckCircle2 className="h-4 w-4 text-warning-fg mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-medium">Daily email digest (Resend)</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Add <code className="bg-accent px-1 rounded-sm">RESEND_API_KEY</code> to Vercel environment variables and to Supabase Edge Function secrets. Schedule the <code className="bg-accent px-1 rounded-sm">daily-digest</code> edge function at <code className="bg-accent px-1 rounded-sm">0 3 * * *</code> UTC (7am Dubai). Set <code className="bg-accent px-1 rounded-sm">DIGEST_RECIPIENTS</code> as a JSON array in edge function secrets.
              </p>
            </div>
          </div>
        </div>
      </Panel>

      {/* Audit log */}
      <Panel
        title="Audit log"
        subtitle="Last 100 events on roles, commission rates, and deals"
        icon={<History className="h-3.5 w-3.5 text-muted-foreground" />}
      >
        {auditLog.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">No audit events yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-[11px]">
                  <th className="text-left py-2 pr-3">Time</th>
                  <th className="text-left py-2 pr-3">Action</th>
                  <th className="text-left py-2 pr-3">Table</th>
                  <th className="text-left py-2">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent">
                {auditLog.map(e => (
                  <tr key={e.id} className="hover:bg-accent/50">
                    <td className="py-2 pr-3 font-mono text-muted-foreground whitespace-nowrap">{new Date(e.created_at).toISOString().slice(0, 19).replace("T", " ")}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded-sm border text-[10px] uppercase ${
                        e.action === "INSERT" ? "border-success/25 bg-success-bg text-success-fg"
                        : e.action === "DELETE" ? "border-danger/25 bg-danger-bg text-danger-fg"
                        : "border-warning/25 bg-warning-bg text-warning-fg"
                      }`}>
                        {e.action}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{e.table_name}</td>
                    <td className="py-2 text-muted-foreground font-mono truncate max-w-[120px]">{e.record_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Data hygiene lists */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="Students without email"
          subtitle="Can't auto-link a portal login"
          icon={<Mail className="h-3.5 w-3.5 text-warning-fg" />}
        >
          {studentsWithoutEmail.length === 0
            ? <Empty text="All active students have an email on file." />
            : (
              <div className="divide-y divide-[var(--accent)]">
                {studentsWithoutEmail.slice(0, 15).map(s => (
                  <Link
                    key={s.id}
                    to="/students/$id"
                    params={{ id: s.id }}
                    className="flex items-center justify-between py-2 text-xs hover:bg-muted"
                  >
                    <span className="truncate">{s.full_name}</span>
                    <span className="text-warning-fg text-[10px]">no email</span>
                  </Link>
                ))}
              </div>
            )}
        </Panel>

        <Panel
          title="Students without coach"
          subtitle="Assign a coach so 1:1s and check-ins can happen"
          icon={<UserX className="h-3.5 w-3.5 text-danger-fg" />}
        >
          {studentsWithoutCoach.length === 0
            ? <Empty text="Every active student has a coach assigned." />
            : (
              <div className="divide-y divide-[var(--accent)]">
                {studentsWithoutCoach.slice(0, 15).map(s => (
                  <Link
                    key={s.id}
                    to="/students/$id"
                    params={{ id: s.id }}
                    className="flex items-center justify-between py-2 text-xs hover:bg-muted"
                  >
                    <span className="truncate">{s.full_name}</span>
                    <span className="text-danger-fg text-[10px]">unassigned</span>
                  </Link>
                ))}
              </div>
            )}
        </Panel>
      </div>
    </div>
  );
}

function buildCompliance(rows: EodRow[], userRoles: UserRole[], profiles: Record<string, Profile>, days: number) {
  const submitted = new Map<string, Set<string>>();
  rows.forEach(r => {
    const s = submitted.get(r.user_id) ?? new Set<string>();
    s.add(r.report_date);
    submitted.set(r.user_id, s);
  });
  const roleMap = new Map<string, string[]>();
  userRoles.forEach(ur => {
    const arr = roleMap.get(ur.user_id) ?? [];
    arr.push(ur.role);
    roleMap.set(ur.user_id, arr);
  });
  return Object.values(profiles)
    .filter(p => {
      const rs = roleMap.get(p.id) ?? [];
      // only members with a reporting role
      return rs.some(r => ["setter", "closer", "coach", "csm"].includes(r));
    })
    .map(p => {
      const subCount = submitted.get(p.id)?.size ?? 0;
      return {
        userId: p.id,
        name: p.display_name ?? "Unknown",
        role: (roleMap.get(p.id) ?? ["member"]).join(" · "),
        submitted: subCount,
        rate: Math.min(100, Math.round((subCount / days) * 100)),
      };
    })
    .sort((a, b) => a.rate - b.rate);
}

function Tile({ label, value, icon, tone = "muted" }: { label: string; value: number; icon: React.ReactNode; tone?: "muted" | "amber" | "rose" }) {
  const c =
    tone === "amber" ? { extra: "border border-warning/25 bg-warning-bg", text: "text-warning-fg" } :
    tone === "rose"  ? { extra: "border border-danger/25 bg-danger-bg",     text: "text-danger-fg" } :
                       { extra: "card-surface",                               text: "text-foreground" };
  return (
    <div className={`rounded-lg p-2.5 ${c.extra}`}>
      <div className="flex items-center gap-1 text-[12px] text-muted-foreground mb-1">{icon}{label}</div>
      <div className={`text-[20px] font-semibold tabular-nums ${c.text}`}>{value}</div>
    </div>
  );
}

function Panel({ title, subtitle, icon, action, children }: { title: string; subtitle?: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[15px] font-semibold">{icon}<span className="truncate">{title}</span></div>
          {subtitle && <div className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-xs text-muted-foreground py-6">{text}</div>;
}

function CommissionRatesCard({
  rows, reload,
}: {
  rows: { id: string; key: string; label: string; rate: number; active: boolean }[];
  reload: () => void;
}) {
  const [draft, setDraft] = useState(rows);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(rows), [rows]);

  const displayRows = draft.length > 0 ? draft : Object.entries(DEFAULT_RATES).map(([k, v]) => ({
    id: k, key: k, label: k.replace(/_/g, " "), rate: v as number, active: true,
  }));

  const save = async () => {
    setSaving(true);
    for (const r of draft) {
      const orig = rows.find(x => x.id === r.id);
      if (!orig || orig.rate !== r.rate) {
        await supabase.from("commission_rates").update({ rate: r.rate }).eq("id", r.id);
      }
    }
    setSaving(false);
    toast.success("Commission rates updated");
    reload();
  };

  return (
    <Panel title="Commission rates" subtitle="Affects future commission calculations. Historical deals reflect the rate at time of display." icon={<Percent className="h-3.5 w-3.5 text-primary" />} action={
      <Button size="sm" onClick={save} disabled={saving}>
        <Save className="h-3.5 w-3.5 mr-1" /> Save
      </Button>
    }>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-1">
        {displayRows.map(r => (
          <div key={r.id} className="space-y-1">
            <Label className="text-xs">{r.label}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number" step="0.001" min="0" max="1"
                value={r.rate}
                onChange={e => setDraft(d => d.map(x => x.id === r.id ? { ...x, rate: Math.max(0, Math.min(1, Number(e.target.value) || 0)) } : x))}
              />
              <span className="text-xs text-muted-foreground w-14 tabular-nums">{(r.rate * 100).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const CHECKLIST_ITEMS: { key: string; label: string; hint: string }[] = [
  { key: "paymentLinks", label: "Payment links seeded", hint: "Add links in Admin → Settings → Payment Links" },
  { key: "commissionConfirmed", label: "Commission rates confirmed", hint: "new_close + set_close rates active in DB" },
  { key: "cashGoalSet", label: "Monthly cash goal set", hint: "Set in Admin → Settings → Monthly Goal" },
  { key: "setterTypesSet", label: "All setters have a type (phone/DM)", hint: "Set inline in Sales HQ or via Admin → Team" },
  { key: "teamInvited", label: "Co-founders / team invited (≥2 admins)", hint: "Invite via Admin → Team" },
  { key: "calendarConnected", label: "At least one calendar connected", hint: "Connect in Calendar → Connect Google Calendar" },
  { key: "igLogged", label: "IG snapshot logged this month", hint: "Log in IG Analytics" },
  { key: "demoRemoved", label: "Demo data removed", hint: "Run npm run demo:remove" },
];

function GoLiveChecklist({ checklist }: { checklist: Record<string, boolean> }) {
  const done = CHECKLIST_ITEMS.filter(i => checklist[i.key]).length;
  const total = CHECKLIST_ITEMS.length;
  const allDone = done === total;

  return (
    <div className={`border rounded-sm p-4 ${allDone ? "border-success/25 bg-success-bg" : "border-warning/25 bg-warning-bg"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Rocket className={`h-4 w-4 ${allDone ? "text-success-fg" : "text-warning-fg"}`} />
        <span className="text-sm font-semibold">Go-live checklist</span>
        <span className={`ml-auto text-xs font-mono ${allDone ? "text-success-fg" : "text-warning-fg"}`}>{done}/{total}</span>
      </div>
      <div className="space-y-1.5">
        {CHECKLIST_ITEMS.map(item => {
          const checked = !!checklist[item.key];
          return (
            <div key={item.key} className="flex items-start gap-2">
              {checked
                ? <CheckCircle2 className="h-3.5 w-3.5 text-success-fg mt-0.5 shrink-0" />
                : <Circle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              }
              <div>
                <span className={`text-xs ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.label}</span>
                {!checked && <div className="text-[10px] text-muted-foreground mt-0.5">{item.hint}</div>}
              </div>
            </div>
          );
        })}
      </div>
      {allDone && (
        <div className="mt-3 text-xs text-success-fg font-medium">Portal is go-live ready ✓</div>
      )}
    </div>
  );
}
