import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertTriangle, ChevronRight, ChevronDown, Trash2, Pencil, Flame, Download } from "lucide-react";
import { computeStreak } from "@/lib/streak";
import { todayBiz } from "@/lib/dates";
import { exportToCsv } from "@/lib/csv";
import confetti from "canvas-confetti";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip as ReTooltip, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/eods")({
  head: () => ({ meta: [{ title: "EOD Reports — ISA Team" }] }),
  component: EODsPage,
});

type EOD = {
  id: string;
  user_id: string;
  report_date: string;
  dms_sent: number; convos_started: number; calls_booked: number; calls_scheduled: number;
  shows: number; no_shows: number;
  looms_reviewed: number; roleplays_reviewed: number; student_checkins: number; escalations_resolved: number;
  calls_taken: number; closes: number; deposits: number;
  cash_collected: number; deferred_cash: number; follow_ups_done: number;
  dials: number; leads_contacted: number;
  wins: string | null; blockers: string | null; tomorrow_focus: string | null; summary: string | null;
};

type SetterType = "phone" | "dm" | null;
type RosterEntry = { user_id: string; display_name: string; primary_role: string; setter_type: SetterType; joined_at: string };
type GridEod = EOD & { display_name?: string; primary_role?: string; setter_type?: SetterType };

// KPI defaults — plain numbers; adjust in Admin → Settings later
const KPI = {
  phone: { primary: { key: "dials" as const, label: "Dials", target: 100 }, sets: 3 },
  dm:    { primary: { key: "leads_contacted" as const, label: "Leads contacted", target: 125 }, sets: 3 },
};

const emptyForm = {
  dms_sent: 0, convos_started: 0, calls_booked: 0, calls_scheduled: 0,
  shows: 0, no_shows: 0,
  looms_reviewed: 0, roleplays_reviewed: 0, student_checkins: 0, escalations_resolved: 0,
  calls_taken: 0, closes: 0, deposits: 0,
  cash_collected: 0, deferred_cash: 0, follow_ups_done: 0,
  dials: 0, leads_contacted: 0,
  wins: "", blockers: "", tomorrow_focus: "", summary: "",
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ROLE_LABEL: Record<string, string> = { setter: "Setter", closer: "Closer", coach: "Coach", csm: "CSM", admin: "Admin" };
const priorityRoles = ["csm", "closer", "coach", "setter", "admin"];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const fmtDayShort = (d: Date) => `${WEEKDAY[d.getDay()]} ${d.getDate()}`;
const fmtLong = (iso: string) => { const d = new Date(iso + "T00:00:00"); return `${WEEKDAY[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`; };
const startOfWeek = (iso: string) => { const d = new Date(iso + "T00:00:00"); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + diff); return isoDate(d); }; // Monday-start

function EODsPage() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const canViewTeam = roles.includes("admin") || roles.includes("closer");
  const isCsm = roles.includes("csm");
  const isSetter = roles.includes("setter");
  const isCloser = roles.includes("closer") || roles.includes("coach");
  const filesEods = isSetter || isCloser || isCsm;
  const isFounder = isAdmin && !filesEods;
  const today = todayBiz();

  const [form, setForm] = useState(emptyForm);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [myEods, setMyEods] = useState<EOD[]>([]);
  const [teamEods, setTeamEods] = useState<GridEod[]>([]);
  const [teamRoster, setTeamRoster] = useState<RosterEntry[]>([]);
  const [mySetterType, setMySetterType] = useState<SetterType>(null);
  const [saving, setSaving] = useState(false);

  const loadMine = async () => {
    if (!user) return;
    const { data } = await supabase.from("eods").select("*").eq("user_id", user.id).order("report_date", { ascending: false }).limit(120);
    const rows = (data ?? []) as EOD[];
    setMyEods(rows);
    const todayEod = rows.find(e => e.report_date === today);
    if (todayEod) {
      setExistingId(todayEod.id);
      setForm({
        dms_sent: todayEod.dms_sent, convos_started: todayEod.convos_started,
        calls_booked: todayEod.calls_booked, calls_scheduled: todayEod.calls_scheduled,
        shows: todayEod.shows, no_shows: todayEod.no_shows,
        looms_reviewed: todayEod.looms_reviewed ?? 0, roleplays_reviewed: todayEod.roleplays_reviewed ?? 0,
        student_checkins: todayEod.student_checkins ?? 0, escalations_resolved: todayEod.escalations_resolved ?? 0,
        calls_taken: todayEod.calls_taken ?? 0, closes: todayEod.closes ?? 0, deposits: todayEod.deposits ?? 0,
        cash_collected: Number(todayEod.cash_collected ?? 0), deferred_cash: Number(todayEod.deferred_cash ?? 0),
        follow_ups_done: todayEod.follow_ups_done ?? 0,
        dials: todayEod.dials ?? 0, leads_contacted: todayEod.leads_contacted ?? 0,
        wins: todayEod.wins ?? "", blockers: todayEod.blockers ?? "",
        tomorrow_focus: todayEod.tomorrow_focus ?? "", summary: todayEod.summary ?? "",
      });
    }
    const { data: prof } = await supabase.from("profiles").select("setter_type").eq("id", user.id).maybeSingle();
    setMySetterType(((prof as { setter_type?: string } | null)?.setter_type ?? null) as SetterType);
  };

  const loadTeam = async () => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 45);
    const { data } = await supabase.from("eods").select("*").gte("report_date", isoDate(cutoff)).order("report_date", { ascending: false });
    const eods = (data ?? []) as EOD[];
    const { data: rolesData } = await supabase.from("user_roles").select("user_id, role").in("role", ["setter", "closer", "coach", "csm"]);
    const userIds = Array.from(new Set([...(rolesData ?? []).map(r => r.user_id), ...eods.map(e => e.user_id)]));
    const { data: profs } = await supabase.from("profiles").select("id, display_name, setter_type, created_at").in("id", userIds);
    const profMap = new Map((profs ?? []).map(p => [p.id, p as { id: string; display_name: string; setter_type: SetterType; created_at: string }]));
    const roleMap = new Map<string, string[]>();
    (rolesData ?? []).forEach(r => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role); roleMap.set(r.user_id, arr);
    });
    const primaryRole = (uid: string) => {
      const rs = roleMap.get(uid) ?? [];
      for (const p of priorityRoles) if (rs.includes(p)) return p;
      return rs[0] ?? "member";
    };
    setTeamEods(eods.map(e => {
      const p = profMap.get(e.user_id);
      return { ...e, display_name: p?.display_name ?? "Unknown", primary_role: primaryRole(e.user_id), setter_type: p?.setter_type ?? null };
    }));
    setTeamRoster(userIds
      .filter(uid => (roleMap.get(uid) ?? []).some(r => ["setter", "closer", "coach", "csm"].includes(r)))
      .map(uid => {
        const p = profMap.get(uid);
        return { user_id: uid, display_name: p?.display_name ?? "Unknown", primary_role: primaryRole(uid), setter_type: p?.setter_type ?? null, joined_at: (p?.created_at ?? "").slice(0, 10) };
      }));
  };

  useEffect(() => { (async () => { await loadMine(); })(); if (canViewTeam) loadTeam(); /* eslint-disable-next-line */ }, [user]);

  // Autosave draft
  const draftKey = user ? `eod-draft:${user.id}:${today}` : null;
  const hydratedDraft = useRef(false);
  useEffect(() => {
    if (!draftKey || hydratedDraft.current || existingId) return;
    try { const raw = localStorage.getItem(draftKey); if (raw) { setForm(f => ({ ...f, ...JSON.parse(raw) })); toast.message("Draft restored"); } } catch {}
    hydratedDraft.current = true;
  }, [draftKey, existingId]);
  useEffect(() => {
    if (!draftKey || existingId) return;
    const t = setTimeout(() => { try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch {} }, 400);
    return () => clearTimeout(t);
  }, [form, draftKey, existingId]);

  const saveSetterType = async (t: SetterType) => {
    if (!user) return;
    setMySetterType(t);
    await supabase.from("profiles").update({ setter_type: t } as never).eq("id", user.id);
  };

  const submit = async () => {
    if (!user) return;
    const cleaned = isCsm
      ? { ...form, dms_sent: 0, convos_started: 0, calls_booked: 0, calls_scheduled: 0, shows: 0, no_shows: 0, calls_taken: 0, closes: 0, deposits: 0, cash_collected: 0, deferred_cash: 0, follow_ups_done: 0, dials: 0, leads_contacted: 0 }
      : form;

    const warnings: string[] = [];
    if (isSetter) {
      if (cleaned.calls_booked > cleaned.convos_started && cleaned.convos_started > 0)
        warnings.push(`${cleaned.calls_booked} booked but only ${cleaned.convos_started} convos — sure?`);
      if ((cleaned.shows + cleaned.no_shows) > cleaned.calls_booked && cleaned.calls_booked > 0)
        warnings.push(`Shows + no-shows (${cleaned.shows + cleaned.no_shows}) exceeds calls booked (${cleaned.calls_booked}).`);
    }
    if (warnings.length && !confirm(warnings.join("\n") + "\n\nSubmit anyway?")) return;

    setSaving(true);
    const wasNew = !existingId;
    const payload = { user_id: user.id, report_date: today, ...cleaned };
    const { error } = await supabase.from("eods").upsert(payload, { onConflict: "user_id,report_date" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existingId ? "EOD updated" : "EOD submitted → Team Reports");
    if (wasNew) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 }, colors: ["#10b981", "#f59e0b", "#3b82f6", "#a855f7"] });
      if (draftKey) { try { localStorage.removeItem(draftKey); } catch {} }
    }
    loadMine();
    if (canViewTeam) loadTeam();
  };

  const deleteEod = async (id: string) => {
    const { error } = await supabase.from("eods").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("EOD deleted");
    if (existingId === id) { setExistingId(null); setForm(emptyForm); }
    loadMine();
    if (canViewTeam) loadTeam();
  };

  const setNum = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: parseInt(v) || 0 }));
  const setFloat = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: parseFloat(v) || 0 }));

  // My-week (personal) numbers
  const myWeek = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const recent = myEods.filter(e => new Date(e.report_date) >= cutoff);
    const sum = (k: keyof EOD) => recent.reduce((a, e) => a + (Number(e[k]) || 0), 0);
    const kpiHitDays = recent.filter(e => didHitKpi(e, mySetterType)).length;
    return { submitted: recent.length, kpiHitDays,
      dials: sum("dials"), leads: sum("leads_contacted"), sets: sum("calls_booked"),
      shows: sum("shows"), cash: sum("cash_collected"), closes: sum("closes") };
  }, [myEods, mySetterType]);
  const streak = useMemo(() => computeStreak(myEods.map(e => e.report_date)), [myEods]);

  // Team-today numbers
  const teamToday = useMemo(() => {
    const rows = teamEods.filter(e => e.report_date === today);
    const sum = (k: keyof EOD) => rows.reduce((a, e) => a + (Number(e[k]) || 0), 0);
    return { submitted: rows.length, expected: teamRoster.length,
      dials: sum("dials") + sum("leads_contacted"),
      booked: sum("calls_booked"),
      cash: sum("cash_collected") };
  }, [teamEods, teamRoster, today]);

  const kpi = mySetterType ? KPI[mySetterType] : null;
  const primaryVal = mySetterType === "dm" ? form.leads_contacted : form.dials;

  const defaultTab = isFounder ? "overview" : (canViewTeam ? "overview" : "submit");

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Daily Reporting</div>
          <h1 className="text-2xl font-semibold tracking-tight">End of Day</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Log your numbers. Track the funnel. Ship consistency.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isFounder && (
            <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm border ${existingId ? "border-green-500/30 bg-green-500/5 text-green-400" : "border-amber-500/30 bg-amber-500/5 text-amber-400"}`}>
              {existingId ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {existingId ? "Today submitted" : "Today pending"}
            </div>
          )}
          <span className="text-[11px] text-muted-foreground">{fmtLong(today)}</span>
        </div>
      </header>

      {/* Two titled groups: My week vs Team today */}
      {(filesEods || canViewTeam) && (
        <div className="grid md:grid-cols-2 gap-3">
          {filesEods && (
            <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">My week (last 7 days)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MiniChip label="Streak" value={`${streak}d`} tone="amber" icon={<Flame className="h-3 w-3" />} />
                <MiniChip label="Reports" value={`${myWeek.submitted}/7`} />
                <MiniChip label="KPI hit" value={`${myWeek.kpiHitDays}/7`} tone={myWeek.kpiHitDays >= 5 ? "green" : "default"} />
                {isSetter && mySetterType === "dm" ? (
                  <MiniChip label="Leads" value={myWeek.leads} />
                ) : isSetter ? (
                  <MiniChip label="Dials" value={myWeek.dials} />
                ) : isCloser ? (
                  <MiniChip label="Cash" value={`$${Math.round(myWeek.cash).toLocaleString()}`} tone="green" />
                ) : (
                  <MiniChip label="Sets" value={myWeek.sets} />
                )}
              </div>
            </div>
          )}
          {canViewTeam && (
            <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Team today</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MiniChip label="Submitted" value={`${teamToday.submitted}/${teamToday.expected}`} tone={teamToday.submitted === teamToday.expected ? "green" : "amber"} />
                <MiniChip label="Dials + leads" value={teamToday.dials.toLocaleString()} />
                <MiniChip label="Booked" value={teamToday.booked} />
                <MiniChip label="Cash" value={`$${Math.round(teamToday.cash).toLocaleString()}`} tone="green" />
              </div>
            </div>
          )}
        </div>
      )}

      {isFounder && (
        <div className="rounded-sm border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          This account has no setter or closer role — you don't submit EODs. Use the tabs below to view team reports.
        </div>
      )}

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="bg-[var(--card)] border border-[var(--border)] rounded-sm h-9 p-0.5 flex-wrap">
          {canViewTeam && <TabsTrigger value="overview" className="text-xs h-8 rounded-sm data-[state=active]:bg-[var(--accent)]">Team Overview</TabsTrigger>}
          {!isFounder && <TabsTrigger value="submit" className="text-xs h-8 rounded-sm data-[state=active]:bg-[var(--accent)]">My EOD</TabsTrigger>}
          {!isFounder && <TabsTrigger value="mine" className="text-xs h-8 rounded-sm data-[state=active]:bg-[var(--accent)]">My history</TabsTrigger>}
          {canViewTeam && <TabsTrigger value="grid" className="text-xs h-8 rounded-sm data-[state=active]:bg-[var(--accent)]">Compliance</TabsTrigger>}
          {canViewTeam && <TabsTrigger value="graphs" className="text-xs h-8 rounded-sm data-[state=active]:bg-[var(--accent)]">Graphs</TabsTrigger>}
          {canViewTeam && <TabsTrigger value="team" className="text-xs h-8 rounded-sm data-[state=active]:bg-[var(--accent)]">Team Feed</TabsTrigger>}
        </TabsList>

        {canViewTeam && (
          <TabsContent value="overview">
            <TeamOverview roster={teamRoster} eods={teamEods} today={today} />
          </TabsContent>
        )}

        <TabsContent value="submit" className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 border border-[var(--border)] bg-[var(--card)] rounded-sm p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{existingId ? "Update today's numbers" : "Submit today's numbers"}</h2>
                  <p className="text-[11px] text-muted-foreground">Zero is a valid answer.</p>
                </div>
              </div>

              {isSetter && !mySetterType && (
                <div className="rounded-sm border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="text-[11px] text-amber-300 mb-2">Pick your setter type — this drives your daily KPI.</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => saveSetterType("phone")}>Phone setter</Button>
                    <Button size="sm" variant="outline" onClick={() => saveSetterType("dm")}>DM setter</Button>
                  </div>
                </div>
              )}

              {isSetter && kpi && (
                <div className="rounded-sm border border-[var(--border)] bg-[var(--background)] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] text-muted-foreground">Today's KPI ({mySetterType === "phone" ? "Phone setter" : "DM setter"})</div>
                    <button className="text-[10px] text-muted-foreground hover:text-foreground underline" onClick={() => saveSetterType(mySetterType === "phone" ? "dm" : "phone")}>Switch type</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <KpiBar label={kpi.primary.label} value={primaryVal} target={kpi.primary.target} />
                    <KpiBar label="Calls booked (sets)" value={form.calls_booked} target={kpi.sets} />
                  </div>
                </div>
              )}

              {isSetter && (
                <div className="space-y-3">
                  <SectionLabel>Setting activity</SectionLabel>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {mySetterType === "dm" ? (
                      <NumField label="Leads contacted" value={form.leads_contacted} onChange={setNum("leads_contacted")} />
                    ) : (
                      <NumField label="Dials" value={form.dials} onChange={setNum("dials")} />
                    )}
                    <NumField label="DMs sent" value={form.dms_sent} onChange={setNum("dms_sent")} />
                    <NumField label="Convos started" value={form.convos_started} onChange={setNum("convos_started")} />
                    <NumField label="Calls booked (sets)" value={form.calls_booked} onChange={setNum("calls_booked")} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <NumField label="Shows" value={form.shows} onChange={setNum("shows")} />
                    <NumField label="No-shows" value={form.no_shows} onChange={setNum("no_shows")} />
                  </div>
                </div>
              )}

              {isCsm && (
                <div className="space-y-3">
                  <SectionLabel>CSM reviews</SectionLabel>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <NumField label="Looms reviewed" value={form.looms_reviewed} onChange={setNum("looms_reviewed")} />
                    <NumField label="Roleplays reviewed" value={form.roleplays_reviewed} onChange={setNum("roleplays_reviewed")} />
                    <NumField label="Student check-ins" value={form.student_checkins} onChange={setNum("student_checkins")} />
                    <NumField label="Escalations solved" value={form.escalations_resolved} onChange={setNum("escalations_resolved")} />
                  </div>
                </div>
              )}

              {isCloser && (
                <>
                  <div className="space-y-3">
                    <SectionLabel>Call activity</SectionLabel>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <NumField label="Calls taken" value={form.calls_taken} onChange={setNum("calls_taken")} />
                      <NumField label="Closes" value={form.closes} onChange={setNum("closes")} />
                      <NumField label="Deposits" value={form.deposits} onChange={setNum("deposits")} />
                      <NumField label="Follow-ups done" value={form.follow_ups_done} onChange={setNum("follow_ups_done")} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <SectionLabel>Cash</SectionLabel>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cash collected today ($)</Label>
                        <Input type="number" min={0} step="0.01" value={form.cash_collected} onChange={e => setFloat("cash_collected")(e.target.value)} onFocus={e => e.currentTarget.select()} className="bg-[var(--background)] border-[var(--border)] rounded-sm h-9 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Deferred cash — PIF &lt;30d ($)</Label>
                        <Input type="number" min={0} step="0.01" value={form.deferred_cash} onChange={e => setFloat("deferred_cash")(e.target.value)} onFocus={e => e.currentTarget.select()} className="bg-[var(--background)] border-[var(--border)] rounded-sm h-9 text-sm" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-3">
                <SectionLabel>Narrative</SectionLabel>
                <TextField label="Wins / summary (required)" value={form.wins} onChange={v => setForm(f => ({ ...f, wins: v }))} rows={3} />
                <TextField label="Blockers (optional)" value={form.blockers} onChange={v => setForm(f => ({ ...f, blockers: v }))} rows={2} />
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-[var(--border)]">
                <Button onClick={submit} disabled={saving || !form.wins.trim()} className="bg-green-500 hover:bg-green-400 text-green-950 font-medium h-8 rounded-sm text-xs">
                  {saving ? "Saving…" : existingId ? "Update EOD" : "Submit EOD"}
                </Button>
              </div>
            </div>

            <aside className="space-y-3">
              {isAdmin ? (
                <SubmittedTodayPanel roster={teamRoster} eods={teamEods} today={today} />
              ) : (
                <MyLast7Panel myEods={myEods} today={today} setterType={mySetterType} />
              )}
              <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4 text-[11px] text-muted-foreground leading-relaxed">
                <div className="text-[10px] uppercase tracking-widest text-green-400 mb-2">Pro tip</div>
                Submit before <span className="text-foreground">23:59</span>. Missed days hurt the team's rolling average.
              </div>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="mine">
          <MyHistory myEods={myEods} setterType={mySetterType} isSetter={isSetter} isCloser={isCloser} onDelete={deleteEod} />
        </TabsContent>

        {canViewTeam && (
          <TabsContent value="grid">
            <ComplianceMatrix eods={teamEods} roster={teamRoster} />
          </TabsContent>
        )}

        {canViewTeam && (
          <TabsContent value="graphs">
            <ComplianceGraphs eods={teamEods} roster={teamRoster} />
          </TabsContent>
        )}

        {canViewTeam && (
          <TabsContent value="team">
            <TeamFeed eods={teamEods} isAdmin={isAdmin} onDelete={deleteEod} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ---------- KPI logic ----------

function didHitKpi(e: EOD, st: SetterType): boolean {
  if (!st) return false;
  const cfg = KPI[st];
  const primary = st === "dm" ? (e.leads_contacted ?? 0) : (e.dials ?? 0);
  return primary >= cfg.primary.target && (e.calls_booked ?? 0) >= cfg.sets;
}

function dayStatus(e: EOD | undefined, st: SetterType): "green" | "amber" | "red" {
  if (!e) return "red";
  if (!st) return "green"; // no KPI defined
  return didHitKpi(e, st) ? "green" : "amber";
}

// ---------- Team Overview ----------

function TeamOverview({ roster, eods, today }: { roster: RosterEntry[]; eods: GridEod[]; today: string }) {
  const weekDays = useMemo(() => {
    const start = new Date(); start.setDate(start.getDate() - 6);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return isoDate(d); });
  }, []);
  const byUserDate = useMemo(() => {
    const m = new Map<string, EOD>();
    eods.forEach(e => m.set(`${e.user_id}::${e.report_date}`, e));
    return m;
  }, [eods]);

  const cards = roster.map(r => {
    const st: SetterType = r.primary_role === "setter" ? r.setter_type : null;
    const todayEod = byUserDate.get(`${r.user_id}::${today}`);
    const status: "green" | "amber" | "red" = !todayEod ? "red" : (r.primary_role === "setter" && st ? (didHitKpi(todayEod, st) ? "green" : "amber") : "green");
    const week = weekDays.map(d => {
      const e = byUserDate.get(`${r.user_id}::${d}`);
      return { d, status: !e ? "red" as const : (r.primary_role === "setter" && st ? (didHitKpi(e, st) ? "green" as const : "amber" as const) : "green" as const), e };
    });
    let weeklyLabel = ""; let weeklyValue: string | number = "";
    if (r.primary_role === "setter") {
      weeklyLabel = "Sets this week";
      weeklyValue = week.reduce((a, x) => a + (x.e?.calls_booked ?? 0), 0);
    } else if (r.primary_role === "closer" || r.primary_role === "coach") {
      weeklyLabel = "Cash this week";
      weeklyValue = `$${Math.round(week.reduce((a, x) => a + Number(x.e?.cash_collected ?? 0), 0)).toLocaleString()}`;
    } else if (r.primary_role === "csm") {
      weeklyLabel = "Check-ins this week";
      weeklyValue = week.reduce((a, x) => a + (x.e?.student_checkins ?? 0), 0);
    }
    let todayLine = "No EOD submitted yet today";
    if (todayEod) {
      if (r.primary_role === "setter" && st) {
        const cfg = KPI[st];
        const primary = st === "dm" ? todayEod.leads_contacted : todayEod.dials;
        if (didHitKpi(todayEod, st)) todayLine = `Submitted — hit KPI (${primary} ${cfg.primary.label.toLowerCase()}, ${todayEod.calls_booked} sets)`;
        else todayLine = `Submitted — missed KPI (${primary} of ${cfg.primary.target} ${cfg.primary.label.toLowerCase()}, ${todayEod.calls_booked} of ${cfg.sets} sets)`;
      } else if (r.primary_role === "closer" || r.primary_role === "coach") {
        todayLine = `Submitted — ${todayEod.calls_taken} calls, ${todayEod.closes} closes, $${Math.round(Number(todayEod.cash_collected)).toLocaleString()} cash`;
      } else if (r.primary_role === "csm") {
        todayLine = `Submitted — ${todayEod.student_checkins} check-ins, ${todayEod.looms_reviewed} looms`;
      } else todayLine = "Submitted";
    }
    return { r, status, todayLine, week, weeklyLabel, weeklyValue, todayEod };
  });

  // Sort red first, amber, green
  const order = { red: 0, amber: 1, green: 2 } as const;
  cards.sort((a, b) => order[a.status] - order[b.status] || a.r.display_name.localeCompare(b.r.display_name));

  const submittedCount = cards.filter(c => c.status !== "red").length;
  const kpiHitCount = cards.filter(c => c.status === "green" && c.todayEod).length;
  const pendingCount = cards.filter(c => c.status === "red").length;

  return (
    <div className="space-y-4">
      <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4">
        <div className="text-sm">
          <span className="font-semibold">{fmtLong(today)}</span> —{" "}
          <span className="text-green-400">{submittedCount} of {cards.length} submitted</span> ·{" "}
          <span className="text-green-400">{kpiHitCount} hit KPI</span> ·{" "}
          <span className="text-amber-400">{pendingCount} pending</span>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {cards.map(c => <OverviewCard key={c.r.user_id} card={c} />)}
        {cards.length === 0 && <EmptyState text="No team members yet." />}
      </div>
    </div>
  );
}

function OverviewCard({ card }: { card: {
  r: RosterEntry; status: "green" | "amber" | "red"; todayLine: string;
  week: { d: string; status: "green" | "amber" | "red"; e: EOD | undefined }[];
  weeklyLabel: string; weeklyValue: string | number; todayEod: EOD | undefined;
} }) {
  const [open, setOpen] = useState(false);
  const dotColor = card.status === "green" ? "bg-green-500" : card.status === "amber" ? "bg-amber-500" : "bg-red-500";
  const setterTypeLabel = card.r.setter_type === "phone" ? "Phone Setter" : card.r.setter_type === "dm" ? "DM Setter" : ROLE_LABEL[card.r.primary_role] ?? card.r.primary_role;
  return (
    <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{card.r.display_name}</div>
          <div className="text-[11px] text-muted-foreground">{setterTypeLabel}</div>
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
          {open ? "Hide" : "Detail"}{open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-3 w-3 rounded-full ${dotColor}`} />
        <span className="text-sm">{card.todayLine}</span>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">This week</div>
        <div className="flex gap-1.5">
          {card.week.map(w => {
            const dt = new Date(w.d + "T00:00:00");
            const bg = w.status === "green" ? "bg-green-500/10 border-green-500/25" : w.status === "amber" ? "bg-amber-500/10 border-amber-500/25" : "bg-red-500/[0.07] border-red-500/20";
            return (
              <div key={w.d} className={`flex-1 border rounded-sm px-1 py-1 text-center ${bg}`} title={fmtLong(w.d)}>
                <div className="text-[9px] text-muted-foreground">{WEEKDAY[dt.getDay()]}</div>
                <div className="text-[10px]">{dt.getDate()}</div>
              </div>
            );
          })}
        </div>
      </div>
      {card.weeklyLabel && (
        <div className="text-sm"><span className="text-muted-foreground">{card.weeklyLabel}:</span> <span className="font-semibold ml-1">{card.weeklyValue}</span></div>
      )}
      {open && (
        <div className="border-t border-[var(--border)] pt-3 space-y-2 text-xs">
          {card.week.map(w => (
            <div key={w.d} className="flex items-start gap-2">
              <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${w.status === "green" ? "bg-green-500" : w.status === "amber" ? "bg-amber-500" : "bg-red-500"}`} />
              <div className="flex-1">
                <div className="text-muted-foreground">{fmtLong(w.d)}</div>
                {w.e ? (
                  <div>
                    {card.r.primary_role === "setter" && (
                      <span>{(card.r.setter_type === "dm" ? w.e.leads_contacted : w.e.dials)} {card.r.setter_type === "dm" ? "leads" : "dials"}, {w.e.calls_booked} sets</span>
                    )}
                    {(card.r.primary_role === "closer" || card.r.primary_role === "coach") && (
                      <span>{w.e.calls_taken} calls, {w.e.closes} closes, ${Math.round(Number(w.e.cash_collected)).toLocaleString()}</span>
                    )}
                    {card.r.primary_role === "csm" && (
                      <span>{w.e.student_checkins} check-ins, {w.e.looms_reviewed} looms</span>
                    )}
                    {w.status === "amber" && <span className="text-amber-400"> — missed KPI</span>}
                    {w.e.wins && <div className="text-muted-foreground mt-0.5"><span className="text-green-400">Wins:</span> {w.e.wins}</div>}
                    {w.e.blockers && <div className="text-muted-foreground"><span className="text-amber-400">Blockers:</span> {w.e.blockers}</div>}
                  </div>
                ) : <div className="text-red-400">No EOD</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- My history (grouped by week) ----------

function MyHistory({ myEods, setterType, isSetter, isCloser, onDelete }: { myEods: EOD[]; setterType: SetterType; isSetter: boolean; isCloser: boolean; onDelete: (id: string) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, EOD[]>();
    myEods.forEach(e => {
      const wk = startOfWeek(e.report_date);
      const arr = m.get(wk) ?? [];
      arr.push(e); m.set(wk, arr);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [myEods]);

  const currentWeek = startOfWeek(isoDate(new Date()));
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set([currentWeek]));
  const toggle = (w: string) => setOpenWeeks(s => { const n = new Set(s); if (n.has(w)) n.delete(w); else n.add(w); return n; });

  if (!groups.length) return <EmptyState text="No EODs yet. Submit your first one above." />;

  return (
    <div className="space-y-3">
      {groups.map(([wk, rows]) => {
        const isOpen = openWeeks.has(wk);
        const submitted = rows.length;
        const dms = rows.reduce((a, e) => a + e.dms_sent, 0);
        const dials = rows.reduce((a, e) => a + (e.dials ?? 0), 0);
        const leads = rows.reduce((a, e) => a + (e.leads_contacted ?? 0), 0);
        const sets = rows.reduce((a, e) => a + e.calls_booked, 0);
        const cash = rows.reduce((a, e) => a + Number(e.cash_collected ?? 0), 0);
        const kpiDays = rows.filter(e => didHitKpi(e, setterType)).length;
        return (
          <div key={wk} className="border border-[var(--border)] bg-[var(--card)] rounded-sm">
            <button onClick={() => toggle(wk)} className="w-full flex items-center justify-between p-3 text-left hover:bg-[var(--muted)]">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span className="text-sm font-semibold">Week of {fmtLong(wk)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground flex gap-3 flex-wrap justify-end">
                <span>{submitted}/7 submitted</span>
                {isSetter && (setterType === "dm" ? <span>{leads} leads</span> : <span>{dials} dials</span>)}
                {isSetter && <span>{sets} sets</span>}
                {isCloser && <span>${Math.round(cash).toLocaleString()} cash</span>}
                {setterType && <span className={kpiDays >= 5 ? "text-green-400" : "text-amber-400"}>KPI {kpiDays} of {submitted}</span>}
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-[var(--border)]">
                {rows.sort((a, b) => b.report_date.localeCompare(a.report_date)).map(e => (
                  <HistoryDayRow key={e.id} eod={e} setterType={setterType} isSetter={isSetter} isCloser={isCloser} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HistoryDayRow({ eod, setterType, isSetter, isCloser, onDelete }: { eod: EOD; setterType: SetterType; isSetter: boolean; isCloser: boolean; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const kpi = setterType ? didHitKpi(eod, setterType) : null;
  const dotClass = kpi === null ? "bg-muted" : kpi ? "bg-green-500" : "bg-amber-500";
  const rawConv = eod.convos_started > 0 ? (eod.calls_booked / eod.convos_started) * 100 : 0;
  const dataError = eod.calls_booked > eod.convos_started && eod.convos_started > 0;
  const convDisplay = Math.min(100, Math.round(rawConv));
  const today = todayBiz();
  const canDelete = eod.report_date === today;
  return (
    <div className="border-b border-[var(--accent)] last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--muted)]">
        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} title={kpi === null ? "" : kpi ? "KPI hit" : "KPI missed"} />
        <div className="text-xs text-muted-foreground w-28 shrink-0">{fmtLong(eod.report_date)}</div>
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          {isSetter && (setterType === "dm"
            ? <RowStat label="Leads" value={eod.leads_contacted} />
            : <RowStat label="Dials" value={eod.dials} />)}
          {isSetter && <RowStat label="Booked" value={eod.calls_booked} accent />}
          {isSetter && <RowStat label="Shows" value={eod.shows} />}
          {isSetter && <RowStat label="Conv%" value={`${convDisplay}%`} />}
          {isCloser && <RowStat label="Calls" value={eod.calls_taken} />}
          {isCloser && <RowStat label="Closes" value={eod.closes} accent />}
          {isCloser && <RowStat label="Cash" value={`$${Math.round(Number(eod.cash_collected)).toLocaleString()}`} />}
        </div>
        {dataError && <span className="text-[10px] text-amber-400 flex items-center gap-1 shrink-0"><AlertTriangle className="h-3 w-3" /> data error</span>}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 text-xs bg-[var(--background)]">
          {dataError && <div className="text-amber-400 text-[11px]">⚠ Booked exceeds convos — this report may have an error. Consider editing.</div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <RowStat label="DMs" value={eod.dms_sent} />
            <RowStat label="Convos" value={eod.convos_started} />
            <RowStat label="Booked" value={eod.calls_booked} />
            <RowStat label="Scheduled" value={eod.calls_scheduled} />
            <RowStat label="Shows" value={eod.shows} />
            <RowStat label="No-shows" value={eod.no_shows} />
          </div>
          {eod.wins && <p><span className="text-green-400">Wins:</span> {eod.wins}</p>}
          {eod.blockers && <p><span className="text-amber-400">Blockers:</span> {eod.blockers}</p>}
          {(eod.summary || eod.tomorrow_focus) && <p className="text-muted-foreground italic">{eod.summary || eod.tomorrow_focus}</p>}
          <div className="flex justify-end gap-2 pt-1">
            {canDelete && (
              <button onClick={() => { if (confirm("Delete this EOD?")) onDelete(eod.id); }} className="text-[11px] text-muted-foreground hover:text-red-400 flex items-center gap-1">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Compliance matrix (no Sunday exclusion) ----------

const ROLE_GROUPS: { key: string; label: string; roles: string[] }[] = [
  { key: "setters", label: "Setters", roles: ["setter"] },
  { key: "closers", label: "Closers", roles: ["closer"] },
  { key: "csm", label: "CSM", roles: ["csm"] },
  { key: "coaches", label: "Coaches", roles: ["coach"] },
];

function buildDayList(days: number): string[] {
  const list: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) { const d = new Date(today); d.setDate(d.getDate() - i); list.push(isoDate(d)); }
  return list.reverse();
}

function ComplianceMatrix({ eods, roster }: { eods: GridEod[]; roster: RosterEntry[] }) {
  const [days, setDays] = useState<7 | 14 | 30 | 90>(14);
  const dayList = useMemo(() => buildDayList(days), [days]);
  const byUserDate = useMemo(() => { const m = new Map<string, EOD>(); eods.forEach(e => m.set(`${e.user_id}::${e.report_date}`, e)); return m; }, [eods]);

  const rowStats = (r: RosterEntry) => {
    const st: SetterType = r.primary_role === "setter" ? r.setter_type : null;
    let streak = 0; let stopped = false; let required = 0; let submitted = 0;
    const sorted = [...dayList].reverse();
    sorted.forEach((d, idx) => {
      const beforeJoin = r.joined_at && d < r.joined_at;
      if (beforeJoin) return; // gray
      required++;
      const hit = byUserDate.has(`${r.user_id}::${d}`);
      if (hit) submitted++;
      if (!stopped) {
        if (hit) streak++;
        else if (idx === 0) { /* today grace */ }
        else stopped = true;
      }
      void st;
    });
    return { streak, submitted, required, pct: required ? Math.round((submitted / required) * 100) : 0 };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-sm border border-border bg-card p-0.5">
          {[7, 14, 30, 90].map(n => (
            <button key={n} onClick={() => setDays(n as 7 | 14 | 30 | 90)} className={`text-[11px] font-semibold px-2.5 py-1 rounded-[2px] transition ${days === n ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>{n}D</button>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground">
          🟢 submitted + KPI hit · 🟡 submitted, missed KPI · 🔴 missed · — before join date
        </div>
      </div>

      <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2 sticky left-0 bg-[var(--card)] z-10">Person</th>
              {dayList.map(d => (<th key={d} className="px-1.5 py-2 text-center font-normal whitespace-nowrap">{fmtDayShort(new Date(d + "T00:00:00"))}</th>))}
              <th className="px-3 py-2 text-right font-normal">Streak</th>
              <th className="px-3 py-2 text-right font-normal">Compliance</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_GROUPS.map(group => {
              const members = roster.filter(r => group.roles.includes(r.primary_role));
              if (!members.length) return null;
              return (
                <React.Fragment key={group.key}>
                  <tr className="bg-[var(--background)]"><td colSpan={dayList.length + 3} className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{group.label} · {members.length}</td></tr>
                  {members.map(m => {
                    const s = rowStats(m);
                    const st: SetterType = m.primary_role === "setter" ? m.setter_type : null;
                    return (
                      <tr key={m.user_id} className="border-b border-[var(--accent)] last:border-0">
                        <td className="px-3 py-2 sticky left-0 bg-[var(--card)] font-medium truncate max-w-[180px]">
                          <div className="text-xs">{m.display_name}</div>
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{m.setter_type ? `${m.setter_type} setter` : m.primary_role}</div>
                        </td>
                        {dayList.map(d => {
                          const beforeJoin = m.joined_at && d < m.joined_at;
                          const eod = byUserDate.get(`${m.user_id}::${d}`);
                          if (beforeJoin) return <td key={d} className="px-1 py-1 text-center"><span className="text-[#3a3f4a] text-[11px]">—</span></td>;
                          const status = dayStatus(eod, st);
                          const cls = status === "green" ? "bg-green-500/10 border-green-500/25 text-green-400" : status === "amber" ? "bg-amber-500/10 border-amber-500/25 text-amber-400" : "bg-red-500/[0.07] border-red-500/20 text-red-400";
                          const glyph = status === "red" ? "✗" : status === "amber" ? "!" : "✓";
                          return (<td key={d} className="px-1 py-1 text-center"><span title={`${m.display_name} · ${fmtLong(d)} · ${status}`} className={`inline-flex items-center justify-center h-5 w-5 rounded-sm border text-[11px] ${cls}`}>{glyph}</span></td>);
                        })}
                        <td className="px-3 py-2 text-right text-xs">
                          <span className={s.streak >= 3 ? "text-amber-400" : "text-foreground"}>{s.streak}</span>
                          <span className="text-muted-foreground text-[10px] ml-1">d</span>
                        </td>
                        <td className="px-3 py-2 text-right text-xs">
                          <span className={s.pct >= 90 ? "text-green-400" : s.pct >= 70 ? "text-amber-400" : "text-red-400"}>{s.pct}%</span>
                          <span className="text-muted-foreground text-[10px] ml-1">({s.submitted}/{s.required})</span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
            {roster.length === 0 && <tr><td colSpan={dayList.length + 3} className="p-8 text-center text-xs text-muted-foreground">No team members with a reporting role yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Graphs (with per-person filter, github-grid) ----------

function ComplianceGraphs({ eods, roster }: { eods: GridEod[]; roster: RosterEntry[] }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [personFilter, setPersonFilter] = useState<string>("all");
  const dayList = useMemo(() => buildDayList(days), [days]);
  const filteredEods = useMemo(() => personFilter === "all" ? eods : eods.filter(e => e.user_id === personFilter), [eods, personFilter]);
  const filteredRoster = useMemo(() => personFilter === "all" ? roster : roster.filter(r => r.user_id === personFilter), [roster, personFilter]);

  const submissionsData = useMemo(() => dayList.map(d => {
    const submitted = filteredEods.filter(e => e.report_date === d).length;
    const expected = personFilter === "all" ? roster.filter(r => !r.joined_at || d >= r.joined_at).length : 1;
    return { date: d, label: fmtDayShort(new Date(d + "T00:00:00")), submitted, expected };
  }), [dayList, filteredEods, roster, personFilter]);

  const funnelData = useMemo(() => dayList.map(d => {
    const dayEods = filteredEods.filter(e => e.report_date === d);
    return {
      date: d, label: fmtDayShort(new Date(d + "T00:00:00")),
      dms: dayEods.reduce((a, e) => a + (e.dms_sent ?? 0), 0),
      convos: dayEods.reduce((a, e) => a + (e.convos_started ?? 0), 0),
      booked: dayEods.reduce((a, e) => a + (e.calls_booked ?? 0), 0),
      shows: dayEods.reduce((a, e) => a + (e.shows ?? 0), 0),
    };
  }), [dayList, filteredEods]);

  const totalReports = filteredEods.filter(e => dayList.includes(e.report_date)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-sm border border-border bg-card p-0.5">
          {[7, 30, 90].map(n => (
            <button key={n} onClick={() => setDays(n as 7 | 30 | 90)} className={`text-[11px] font-semibold px-2.5 py-1 rounded-[2px] transition ${days === n ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>{n}D</button>
          ))}
        </div>
        <select value={personFilter} onChange={e => setPersonFilter(e.target.value)} className="text-[11px] bg-[var(--background)] border border-[var(--border)] rounded-sm h-7 px-2">
          <option value="all">All team</option>
          {roster.map(r => <option key={r.user_id} value={r.user_id}>{r.display_name}</option>)}
        </select>
      </div>

      <GraphCard title="Reports submitted vs expected" subtitle="Green = submitted, gray = expected total">
        {totalReports === 0 ? <NoData /> : <SubmissionsChart data={submissionsData} />}
      </GraphCard>

      <GraphCard title="Funnel volume — daily totals" subtitle="DMs · convos · booked · shows">
        {totalReports === 0 ? <NoData /> : <FunnelChart data={funnelData} />}
      </GraphCard>

      <GraphCard title="EOD submissions per person" subtitle="One square per day — green = submitted + hit KPI, amber = submitted only, red = missed">
        <SubmissionsGrid dayList={dayList} roster={filteredRoster} eods={eods} />
      </GraphCard>
    </div>
  );
}

function SubmissionsGrid({ dayList, roster, eods }: { dayList: string[]; roster: RosterEntry[]; eods: GridEod[] }) {
  const byUserDate = useMemo(() => { const m = new Map<string, EOD>(); eods.forEach(e => m.set(`${e.user_id}::${e.report_date}`, e)); return m; }, [eods]);
  if (!roster.length) return <NoData />;
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="space-y-1 min-w-fit">
        {roster.map(r => {
          const st: SetterType = r.primary_role === "setter" ? r.setter_type : null;
          return (
            <div key={r.user_id} className="flex items-center gap-2">
              <div className="text-[11px] text-muted-foreground w-28 shrink-0 truncate">{r.display_name}</div>
              <div className="flex gap-0.5">
                {dayList.map(d => {
                  const beforeJoin = r.joined_at && d < r.joined_at;
                  const eod = byUserDate.get(`${r.user_id}::${d}`);
                  const bg = beforeJoin ? "bg-white/[0.04]" : !eod ? "bg-red-500/25" : st ? (didHitKpi(eod, st) ? "bg-green-500/35" : "bg-amber-500/30") : "bg-green-500/35";
                  return <div key={d} className={`h-3 w-3 rounded-[2px] ${bg}`} title={`${r.display_name} · ${fmtLong(d)} · ${!eod ? "missed" : "submitted"}`} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NoData() { return <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground">No reports in this period.</div>; }

function GraphCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4">
      <div className="mb-3">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function SubmissionsChart({ data }: { data: { label: string; submitted: number; expected: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8A919C" }} />
        <YAxis tick={{ fontSize: 10, fill: "#8A919C" }} allowDecimals={false} />
        <ReTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="expected" fill="var(--border)" name="Expected" />
        <Bar dataKey="submitted" fill="#10b981" name="Submitted" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FunnelChart({ data }: { data: { label: string; dms: number; convos: number; booked: number; shows: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8A919C" }} />
        <YAxis tick={{ fontSize: 10, fill: "#8A919C" }} allowDecimals={false} />
        <ReTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Line type="monotone" dataKey="dms" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="DMs" />
        <Line type="monotone" dataKey="convos" stroke="#a855f7" strokeWidth={1.5} dot={false} name="Convos" />
        <Line type="monotone" dataKey="booked" stroke="#10b981" strokeWidth={2} dot={false} name="Booked" />
        <Line type="monotone" dataKey="shows" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Shows" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------- Team feed ----------

function TeamFeed({ eods, isAdmin, onDelete }: { eods: GridEod[]; isAdmin: boolean; onDelete: (id: string) => void }) {
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [role, setRole] = useState<string>("all");
  const [person, setPerson] = useState<string>("all");
  const cutoff = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - days); return isoDate(d); }, [days]);
  const filtered = useMemo(() => eods
    .filter(e => e.report_date >= cutoff)
    .filter(e => role === "all" ? true : e.primary_role === role)
    .filter(e => person === "all" ? true : e.user_id === person), [eods, cutoff, role, person]);

  const grouped = useMemo(() => {
    const m = new Map<string, GridEod[]>();
    filtered.forEach(e => { const arr = m.get(e.report_date) ?? []; arr.push(e); m.set(e.report_date, arr); });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const people = useMemo(() => Array.from(new Map(eods.map(e => [e.user_id, e.display_name])).entries()), [eods]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex rounded-sm border border-border bg-card p-0.5">
          {[7, 14, 30].map(n => (
            <button key={n} onClick={() => setDays(n as 7 | 14 | 30)} className={`text-[11px] font-semibold px-2.5 py-1 rounded-[2px] transition ${days === n ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>{n}D</button>
          ))}
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="text-[11px] bg-[var(--background)] border border-[var(--border)] rounded-sm h-7 px-2">
          <option value="all">All roles</option>
          {["setter","closer","coach","csm"].map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <select value={person} onChange={e => setPerson(e.target.value)} className="text-[11px] bg-[var(--background)] border border-[var(--border)] rounded-sm h-7 px-2">
          <option value="all">Everyone</option>
          {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <button
          onClick={() => exportToCsv(`eods-${days}d.csv`, filtered.map(e => ({
            date: e.report_date, name: e.display_name, role: e.primary_role,
            dials: e.dials, leads: e.leads_contacted, sets: e.calls_booked,
            shows: e.shows, no_shows: e.no_shows,
          })))}
          className="ml-auto h-7 px-2.5 flex items-center gap-1.5 rounded-sm border border-[var(--border)] text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition"
        >
          <Download className="h-3 w-3" /> Export CSV
        </button>
      </div>

      {grouped.length === 0 && <EmptyState text="No EODs in this range." />}
      {grouped.map(([day, rows]) => (
        <div key={day} className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-[var(--border)] pb-1">
            {fmtLong(day)} — {rows.length} submitted
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {rows.map(e => <FeedCard key={e.id} e={e} isAdmin={isAdmin} onDelete={onDelete} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedCard({ e, isAdmin, onDelete }: { e: GridEod; isAdmin: boolean; onDelete: (id: string) => void }) {
  const st: SetterType = e.primary_role === "setter" ? (e.setter_type ?? null) : null;
  const kpi = st ? didHitKpi(e, st) : null;
  const chips: { label: string; value: string | number }[] = [];
  if (e.primary_role === "setter") {
    if (st === "dm") chips.push({ label: "Leads", value: e.leads_contacted });
    else chips.push({ label: "Dials", value: e.dials });
    chips.push({ label: "Sets", value: e.calls_booked });
    chips.push({ label: "Shows", value: e.shows });
  } else if (e.primary_role === "closer" || e.primary_role === "coach") {
    chips.push({ label: "Calls", value: e.calls_taken });
    chips.push({ label: "Closes", value: e.closes });
    chips.push({ label: "Cash", value: `$${Math.round(Number(e.cash_collected)).toLocaleString()}` });
  } else if (e.primary_role === "csm") {
    chips.push({ label: "Check-ins", value: e.student_checkins });
    chips.push({ label: "Looms", value: e.looms_reviewed });
    chips.push({ label: "Roleplays", value: e.roleplays_reviewed });
  }
  return (
    <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{e.display_name}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{st ? `${st} setter` : e.primary_role}</div>
        </div>
        <div className="flex items-center gap-2">
          {kpi !== null && <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${kpi ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>KPI {kpi ? "✓" : "✗"}</span>}
          {isAdmin && (
            <button onClick={() => { if (confirm("Delete this EOD?")) onDelete(e.id); }} className="text-muted-foreground hover:text-red-400" title="Delete">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {chips.map(c => (
          <span key={c.label} className="text-[11px] bg-[var(--background)] border border-[var(--border)] px-2 py-0.5 rounded-sm">
            <span className="text-muted-foreground">{c.label}</span> <span className="">{c.value}</span>
          </span>
        ))}
      </div>
      {e.wins && <p className="text-[11px]"><span className="text-green-400">Wins:</span> {e.wins}</p>}
      {e.blockers && <p className="text-[11px]"><span className="text-amber-400">Blockers:</span> {e.blockers}</p>}
    </div>
  );
}

// ---------- Side panels ----------

function SubmittedTodayPanel({ roster, eods, today }: { roster: RosterEntry[]; eods: GridEod[]; today: string }) {
  const submittedIds = new Set(eods.filter(e => e.report_date === today).map(e => e.user_id));
  return (
    <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Who's submitted today</div>
      <div className="space-y-1.5 text-xs max-h-64 overflow-y-auto">
        {roster.map(r => (
          <div key={r.user_id} className="flex items-center justify-between">
            <span className="truncate">{r.display_name}</span>
            {submittedIds.has(r.user_id) ? <span className="text-green-400 text-[11px]">✓</span> : <span className="text-amber-400 text-[11px]">pending</span>}
          </div>
        ))}
        {roster.length === 0 && <div className="text-muted-foreground">No team yet.</div>}
      </div>
    </div>
  );
}

function MyLast7Panel({ myEods, today, setterType }: { myEods: EOD[]; today: string; setterType: SetterType }) {
  const days = useMemo(() => { const list: string[] = []; const t = new Date(today + "T00:00:00"); for (let i = 6; i >= 0; i--) { const d = new Date(t); d.setDate(t.getDate() - i); list.push(isoDate(d)); } return list; }, [today]);
  const byDate = new Map(myEods.map(e => [e.report_date, e]));
  return (
    <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">My last 7 days</div>
      <div className="space-y-1.5 text-xs">
        {days.map(d => {
          const e = byDate.get(d);
          const status = dayStatus(e, setterType);
          const glyph = !e ? "✗" : status === "amber" ? "!" : "✓";
          const cls = !e ? "text-red-400" : status === "amber" ? "text-amber-400" : "text-green-400";
          return (<div key={d} className="flex items-center justify-between"><span className="text-muted-foreground">{fmtLong(d)}</span><span className={`text-[11px] ${cls}`}>{glyph}</span></div>);
        })}
      </div>
    </div>
  );
}

// ---------- Small parts ----------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground border-b border-[var(--border)] pb-1.5">{children}</div>;
}

function MiniChip({ label, value, tone, icon }: { label: string; value: number | string; tone?: "green" | "amber" | "default"; icon?: React.ReactNode }) {
  const cls = tone === "green" ? "border-green-500/30 bg-green-500/5 text-green-400" : tone === "amber" ? "border-amber-500/30 bg-amber-500/5 text-amber-400" : "border-[var(--border)] bg-[var(--background)] text-foreground";
  return (
    <div className={`border rounded-sm p-2 ${cls}`}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">{icon}{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function KpiBar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, target ? Math.round((value / target) * 100) : 0);
  const hit = value >= target;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`text-[11px] ${hit ? "text-green-400 font-semibold" : "text-foreground"}`}>{value} / {target}</span>
      </div>
      <div className="h-1.5 bg-[var(--accent)] rounded-sm overflow-hidden">
        <div className={`h-full ${hit ? "bg-green-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  const bump = (d: number) => onChange(String(Math.max(0, value + d)));
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => bump(-1)} className="h-9 w-8 rounded-sm border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-lg leading-none">−</button>
        <Input type="number" min={0} value={value} onChange={e => onChange(e.target.value)} onFocus={e => e.currentTarget.select()} className="bg-[var(--background)] border-[var(--border)] rounded-sm h-9 text-sm text-center" />
        <button type="button" onClick={() => bump(1)} className="h-9 w-8 rounded-sm border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-lg leading-none">+</button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} className="bg-[var(--background)] border-[var(--border)] rounded-sm text-sm resize-none" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="border border-dashed border-[var(--border)] rounded-sm p-8 text-center text-xs text-muted-foreground">{text}</div>;
}

function RowStat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`${accent ? "text-green-400 font-semibold" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
