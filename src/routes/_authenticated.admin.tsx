import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { format, subDays } from "date-fns";
import {
  Shield, CheckCircle2, AlertTriangle, Users, Mail, UserX, Star,
  ArrowUpRight, ClipboardList,
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

  const days = RANGES.find(r => r.key === range)!.days;

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    const from = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
    (async () => {
      const [eodRes, profRes, roleRes, studRes, callsRes] = await Promise.all([
        supabase.from("eods").select("id, user_id, report_date").gte("report_date", from),
        supabase.from("profiles").select("id, display_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("students").select("id, full_name, email, coach_id, status, first_win_at, testimonial_collected, trustpilot_collected"),
        supabase.from("student_calls").select("id, student_id, call_date, coach_id, progress_rating").eq("status", "completed").is("progress_rating", null).order("call_date", { ascending: false }).limit(50),
      ]);
      setEods((eodRes.data as EodRow[]) ?? []);
      const pmap: Record<string, Profile> = {};
      (profRes.data as Profile[] | null)?.forEach(p => { pmap[p.id] = p; });
      setProfiles(pmap);
      setUserRoles((roleRes.data as UserRole[]) ?? []);
      setStudents((studRes.data as Student[]) ?? []);
      setUnratedCalls((callsRes.data as CallRow[]) ?? []);
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
        <div className="border border-red-500/30 bg-red-500/5 rounded-sm p-8 text-center">
          <Shield className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <div className="text-sm text-red-400 font-medium">Admin access required</div>
          <p className="text-xs text-muted-foreground mt-1">You need the admin role to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-red-400 mb-1">
            <Shield className="h-3 w-3" /> Admin console
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Team health & administration</h1>
          <p className="text-xs text-muted-foreground mt-0.5">For deep analytics see <Link to="/analytics" className="underline hover:text-foreground">/analytics</Link>.</p>
        </div>
        <div className="flex items-center gap-1 border border-[#1f2530] bg-[#0f1116] rounded-sm p-0.5">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1 text-[11px] font-medium rounded-sm transition ${
                range === r.key ? "bg-green-500/15 text-green-400" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

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
            <div key={r} className="border border-[#1f2530] rounded-sm bg-[#0a0b0f] p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r}</div>
              <div className="text-lg font-mono font-semibold mt-0.5">{roleCounts[r] ?? 0}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Two-column: EOD compliance + Unrated calls */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="EOD compliance"
          subtitle={`Reports submitted in last ${days} days`}
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
        >
          <div className="divide-y divide-[#1a1f29]">
            {compliance.length === 0 && !loading && <Empty text="No team members yet." />}
            {compliance.map(c => (
              <div key={c.userId} className="flex items-center gap-3 py-2.5">
                <div className="h-7 w-7 rounded-sm bg-[#1a1f29] border border-[#1f2530] flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{c.role}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-[#1a1f29] overflow-hidden">
                    <div
                      className={`h-full ${c.rate >= 80 ? "bg-green-500" : c.rate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${c.rate}%` }}
                    />
                  </div>
                  <div className={`text-xs font-mono w-14 text-right ${c.rate >= 80 ? "text-green-400" : c.rate >= 50 ? "text-amber-400" : "text-red-400"}`}>
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
          icon={<ClipboardList className="h-3.5 w-3.5 text-amber-400" />}
          action={<Link to="/calls" className="text-[11px] px-2.5 py-1 rounded-sm border border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Open Calls <ArrowUpRight className="h-3 w-3" /></Link>}
        >
          <div className="divide-y divide-[#1a1f29]">
            {unratedCalls.length === 0 && !loading && <Empty text="All completed calls are rated. 🎉" />}
            {unratedCalls.slice(0, 12).map(c => {
              const student = students.find(s => s.id === c.student_id);
              const coach = c.coach_id ? profiles[c.coach_id]?.display_name : null;
              return (
                <div key={c.id} className="grid grid-cols-[80px_1fr_1fr] gap-3 py-2.5 text-xs items-center">
                  <span className="font-mono text-muted-foreground">{c.call_date}</span>
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

      {/* Data hygiene lists */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel
          title="Students without email"
          subtitle="Can't auto-link a portal login"
          icon={<Mail className="h-3.5 w-3.5 text-amber-400" />}
        >
          {studentsWithoutEmail.length === 0
            ? <Empty text="All active students have an email on file." />
            : (
              <div className="divide-y divide-[#1a1f29]">
                {studentsWithoutEmail.slice(0, 15).map(s => (
                  <Link
                    key={s.id}
                    to="/students/$id"
                    params={{ id: s.id }}
                    className="flex items-center justify-between py-2 text-xs hover:bg-white/[0.02]"
                  >
                    <span className="truncate">{s.full_name}</span>
                    <span className="text-amber-400 text-[10px] font-mono">no email</span>
                  </Link>
                ))}
              </div>
            )}
        </Panel>

        <Panel
          title="Students without coach"
          subtitle="Assign a coach so 1:1s and check-ins can happen"
          icon={<UserX className="h-3.5 w-3.5 text-red-400" />}
        >
          {studentsWithoutCoach.length === 0
            ? <Empty text="Every active student has a coach assigned." />
            : (
              <div className="divide-y divide-[#1a1f29]">
                {studentsWithoutCoach.slice(0, 15).map(s => (
                  <Link
                    key={s.id}
                    to="/students/$id"
                    params={{ id: s.id }}
                    className="flex items-center justify-between py-2 text-xs hover:bg-white/[0.02]"
                  >
                    <span className="truncate">{s.full_name}</span>
                    <span className="text-red-400 text-[10px] font-mono">unassigned</span>
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
    tone === "amber" ? { border: "border-amber-500/40", bg: "bg-amber-500/5", text: "text-amber-400" } :
    tone === "rose"  ? { border: "border-red-500/40",  bg: "bg-red-500/5",  text: "text-red-400" } :
                       { border: "border-[#1f2530]",    bg: "bg-[#0f1116]",   text: "text-foreground" };
  return (
    <div className={`border rounded-sm p-2.5 ${c.border} ${c.bg}`}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{icon}{label}</div>
      <div className={`text-lg font-mono font-semibold ${c.text}`}>{value}</div>
    </div>
  );
}

function Panel({ title, subtitle, icon, action, children }: { title: string; subtitle?: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold">{icon}<span className="truncate">{title}</span></div>
          {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
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
