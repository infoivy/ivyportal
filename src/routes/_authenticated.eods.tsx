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
import { CheckCircle2, Clock, TrendingUp, Users, Phone, Target, AlertTriangle, ChevronRight, Trash2, HeartHandshake, Flame } from "lucide-react";
import { computeStreak } from "@/lib/streak";
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
  wins: string | null; blockers: string | null; tomorrow_focus: string | null; summary: string | null;
};

const emptyForm = {
  dms_sent: 0, convos_started: 0, calls_booked: 0, calls_scheduled: 0,
  shows: 0, no_shows: 0,
  looms_reviewed: 0, roleplays_reviewed: 0, student_checkins: 0, escalations_resolved: 0,
  calls_taken: 0, closes: 0, deposits: 0,
  cash_collected: 0, deferred_cash: 0, follow_ups_done: 0,
  wins: "", blockers: "", tomorrow_focus: "", summary: "",
};

function EODsPage() {
  const { user, roles } = useAuth();
  const canViewTeam = roles.includes("admin") || roles.includes("closer");
  const isCsm = roles.includes("csm");
  const isCloser = roles.includes("closer") || roles.includes("coach");
  const filesEods = roles.includes("setter") || roles.includes("closer") || roles.includes("coach") || roles.includes("csm");
  const isFounder = roles.includes("admin") && !filesEods;
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState(emptyForm);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [myEods, setMyEods] = useState<EOD[]>([]);
  const [teamEods, setTeamEods] = useState<(EOD & { display_name?: string; primary_role?: string })[]>([]);
  const [saving, setSaving] = useState(false);

  const loadMine = async () => {
    if (!user) return;
    const { data } = await supabase.from("eods").select("*").eq("user_id", user.id).order("report_date", { ascending: false }).limit(30);
    setMyEods((data ?? []) as EOD[]);
    const todayEod = (data ?? []).find(e => e.report_date === today);
    if (todayEod) {
      setExistingId(todayEod.id);
      setForm({
        dms_sent: todayEod.dms_sent, convos_started: todayEod.convos_started,
        calls_booked: todayEod.calls_booked, calls_scheduled: todayEod.calls_scheduled,
        shows: todayEod.shows, no_shows: todayEod.no_shows,
        looms_reviewed: todayEod.looms_reviewed ?? 0,
        roleplays_reviewed: todayEod.roleplays_reviewed ?? 0,
        student_checkins: todayEod.student_checkins ?? 0,
        escalations_resolved: todayEod.escalations_resolved ?? 0,
        calls_taken: todayEod.calls_taken ?? 0,
        closes: todayEod.closes ?? 0,
        deposits: todayEod.deposits ?? 0,
        cash_collected: Number(todayEod.cash_collected ?? 0),
        deferred_cash: Number(todayEod.deferred_cash ?? 0),
        follow_ups_done: todayEod.follow_ups_done ?? 0,
        wins: todayEod.wins ?? "", blockers: todayEod.blockers ?? "",
        tomorrow_focus: todayEod.tomorrow_focus ?? "", summary: todayEod.summary ?? "",
      });
    }
  };

  const [teamRoster, setTeamRoster] = useState<{ user_id: string; display_name: string; primary_role: string }[]>([]);

  const loadTeam = async () => {
    // Wider window for compliance / graphs (up to 30 days × ~15 people)
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 45);
    const { data } = await supabase.from("eods").select("*").gte("report_date", cutoff.toISOString().slice(0, 10)).order("report_date", { ascending: false });
    const eods = (data ?? []) as EOD[];
    // Load the full team roster (anyone with a reporting role), so people
    // with zero submissions still appear as red ✗ rows in the matrix.
    const { data: rolesData } = await supabase.from("user_roles").select("user_id, role").in("role", ["setter", "closer", "coach", "csm"]);
    const userIds = Array.from(new Set([...(rolesData ?? []).map(r => r.user_id), ...eods.map(e => e.user_id)]));
    const [profRes] = await Promise.all([
      supabase.from("profiles").select("id, display_name").in("id", userIds),
    ]);
    const nameMap = new Map(profRes.data?.map(p => [p.id, p.display_name]) ?? []);
    const roleMap = new Map<string, string[]>();
    (rolesData ?? []).forEach(r => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    // Priority: csm > closer > coach > setter (for grouping)
    const priority = ["csm", "closer", "coach", "setter", "admin"];
    const primaryRole = (uid: string): string => {
      const rs = roleMap.get(uid) ?? [];
      for (const p of priority) if (rs.includes(p)) return p;
      return rs[0] ?? "member";
    };
    setTeamEods(eods.map(e => ({
      ...e,
      display_name: nameMap.get(e.user_id) ?? "Unknown",
      primary_role: primaryRole(e.user_id),
    })));
    setTeamRoster(userIds
      .filter(uid => (roleMap.get(uid) ?? []).some(r => ["setter", "closer", "coach", "csm"].includes(r)))
      .map(uid => ({ user_id: uid, display_name: nameMap.get(uid) ?? "Unknown", primary_role: primaryRole(uid) })));
  };

  const syncCsmTally = async () => {
    if (!user || !isCsm) return;
    const start = today + "T00:00:00.000Z";
    const end = today + "T23:59:59.999Z";
    const { data } = await supabase
      .from("csm_tally")
      .select("kind")
      .eq("user_id", user.id)
      .gte("created_at", start)
      .lte("created_at", end);
    if (!data) return;
    const counts = { loom: 0, roleplay: 0, checkin: 0, escalation: 0 } as Record<string, number>;
    data.forEach(r => { counts[r.kind] = (counts[r.kind] ?? 0) + 1; });
    setForm(prev => ({
      ...prev,
      looms_reviewed:       Math.max(prev.looms_reviewed,       counts.loom),
      roleplays_reviewed:   Math.max(prev.roleplays_reviewed,   counts.roleplay),
      student_checkins:     Math.max(prev.student_checkins,     counts.checkin),
      escalations_resolved: Math.max(prev.escalations_resolved, counts.escalation),
    }));
  };

  useEffect(() => { (async () => { await loadMine(); await syncCsmTally(); })(); if (canViewTeam) loadTeam(); /* eslint-disable-next-line */ }, [user]);

  // Autosave draft to localStorage while composing today's EOD (skip if already submitted)
  const draftKey = user ? `eod-draft:${user.id}:${today}` : null;
  const hydratedDraft = useRef(false);
  useEffect(() => {
    if (!draftKey || hydratedDraft.current || existingId) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setForm(f => ({ ...f, ...parsed }));
        toast.message("Draft restored");
      }
    } catch {}
    hydratedDraft.current = true;
  }, [draftKey, existingId]);
  useEffect(() => {
    if (!draftKey || existingId) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(form)); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [form, draftKey, existingId]);

  // Yesterday's tomorrow_focus as a hint for today's summary/wins
  const yesterday = useMemo(() => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().slice(0, 10);
    return myEods.find(e => e.report_date === yStr) ?? null;
  }, [myEods]);

  const submit = async () => {
    if (!user) return;
    // For CSMs, force setter/closer-only fields to zero so a CSM EOD never
    // gets written with stray funnel/close numbers from state or stale drafts.
    const cleaned = isCsm
      ? {
          ...form,
          dms_sent: 0, convos_started: 0, calls_booked: 0, calls_scheduled: 0,
          shows: 0, no_shows: 0,
          calls_taken: 0, closes: 0, deposits: 0,
          cash_collected: 0, deferred_cash: 0, follow_ups_done: 0,
        }
      : form;
    // Cross-field sanity checks (warn, don't hard-block) — only meaningful for setters
    const warnings: string[] = [];
    if (!isCsm) {
      if (cleaned.calls_booked > cleaned.convos_started) warnings.push(`Calls booked (${cleaned.calls_booked}) is higher than convos started (${cleaned.convos_started}).`);
      if (cleaned.convos_started > cleaned.dms_sent) warnings.push(`Convos started (${cleaned.convos_started}) is higher than DMs sent (${cleaned.dms_sent}).`);
      if ((cleaned.shows + cleaned.no_shows) > cleaned.calls_booked) warnings.push(`Shows + no-shows (${cleaned.shows + cleaned.no_shows}) exceeds calls booked (${cleaned.calls_booked}).`);
    }
    if (warnings.length && !confirm(warnings.join("\n") + "\n\nAre you sure these numbers are right?")) return;
    setSaving(true);
    const wasNew = !existingId;
    const payload = { user_id: user.id, report_date: today, ...cleaned };
    const { error } = await supabase.from("eods").upsert(payload, { onConflict: "user_id,report_date" });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(existingId ? "EOD updated" : "EOD submitted");
      if (wasNew) {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 }, colors: ["#10b981", "#f59e0b", "#3b82f6", "#a855f7"] });
        if (draftKey) { try { localStorage.removeItem(draftKey); } catch {} }
      }
      loadMine();
      if (canViewTeam) loadTeam();
    }
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

  // 7-day rolling summary for the current user + streak
  const weekly = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const recent = myEods.filter(e => new Date(e.report_date) >= cutoff);
    const sum = (k: keyof EOD) => recent.reduce((a, e) => a + (Number(e[k]) || 0), 0);
    return {
      dms: sum("dms_sent"), convos: sum("convos_started"), booked: sum("calls_booked"),
      shows: sum("shows"), noshows: sum("no_shows"), submitted: recent.length,
      looms: sum("looms_reviewed"), roleplays: sum("roleplays_reviewed"), checkins: sum("student_checkins"), escalations: sum("escalations_resolved"),
    };
  }, [myEods]);
  const streak = useMemo(() => computeStreak(myEods.map(e => e.report_date)), [myEods]);

  const conv = form.convos_started > 0 ? Math.round((form.calls_booked / form.convos_started) * 100) : 0;
  const showRate = (form.shows + form.no_shows) > 0 ? Math.round((form.shows / (form.shows + form.no_shows)) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">Daily Reporting</div>
          <h1 className="text-2xl font-semibold tracking-tight">End of Day</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Log your numbers. Track the funnel. Ship consistency.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isFounder && (
            <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm border ${existingId ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-amber-500/30 bg-amber-500/5 text-amber-400"}`}>
              {existingId ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {existingId ? "Today submitted" : "Today pending"}
            </div>
          )}
          <span className="text-[11px] text-muted-foreground font-mono">{today}</span>
        </div>
      </header>

      {!isFounder && (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <div className="border rounded-sm p-2.5 border-amber-500/40 bg-amber-500/5">
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-400 mb-1"><Flame className="h-3 w-3" /> Streak</div>
            <div className="text-lg font-mono font-semibold text-amber-400">{streak}<span className="text-xs text-muted-foreground ml-1">days</span></div>
          </div>
          <WeekTile label={isCsm ? "7d looms" : "7d DMs"} value={isCsm ? weekly.looms : weekly.dms} icon={isCsm ? <HeartHandshake className="h-3 w-3" /> : <Users className="h-3 w-3" />} />
          <WeekTile label={isCsm ? "7d roleplays" : "7d Convos"} value={isCsm ? weekly.roleplays : weekly.convos} icon={<TrendingUp className="h-3 w-3" />} />
          <WeekTile label={isCsm ? "7d check-ins" : "7d Booked"} value={isCsm ? weekly.checkins : weekly.booked} icon={<Phone className="h-3 w-3" />} accent />
          <WeekTile label={isCsm ? "7d escalations" : "7d Shows"} value={isCsm ? weekly.escalations : weekly.shows} icon={<Target className="h-3 w-3" />} />
          <WeekTile label="7d No-shows" value={weekly.noshows} icon={<AlertTriangle className="h-3 w-3" />} />
          <WeekTile label="Reports" value={`${weekly.submitted}/7`} icon={<CheckCircle2 className="h-3 w-3" />} />
        </div>
      )}

      <Tabs defaultValue={isFounder ? "grid" : "submit"} className="space-y-4">
        <TabsList className="bg-[#0f1116] border border-[#1f2530] rounded-sm h-9 p-0.5">
          {!isFounder && <TabsTrigger value="submit" className="text-xs h-8 rounded-sm data-[state=active]:bg-[#1a1f29]">My EOD</TabsTrigger>}
          {!isFounder && <TabsTrigger value="mine" className="text-xs h-8 rounded-sm data-[state=active]:bg-[#1a1f29]">My history</TabsTrigger>}
          {canViewTeam && <TabsTrigger value="grid" className="text-xs h-8 rounded-sm data-[state=active]:bg-[#1a1f29]">Team Compliance</TabsTrigger>}
          {canViewTeam && <TabsTrigger value="graphs" className="text-xs h-8 rounded-sm data-[state=active]:bg-[#1a1f29]">Graphs</TabsTrigger>}
          {canViewTeam && <TabsTrigger value="team" className="text-xs h-8 rounded-sm data-[state=active]:bg-[#1a1f29]">Team Feed</TabsTrigger>}
        </TabsList>

        <TabsContent value="submit" className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 border border-[#1f2530] bg-[#0f1116] rounded-sm p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{existingId ? "Update today's numbers" : "Submit today's numbers"}</h2>
                  <p className="text-[11px] text-muted-foreground">All fields required. Zero is a valid answer.</p>
                </div>
              </div>

              {!isCsm && (
                <div className="space-y-3">
                  <SectionLabel>Funnel volume</SectionLabel>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <NumField label="DMs sent" value={form.dms_sent} onChange={setNum("dms_sent")} />
                    <NumField label="Convos started" value={form.convos_started} onChange={setNum("convos_started")} />
                    <NumField label="Calls booked" value={form.calls_booked} onChange={setNum("calls_booked")} />
                    <NumField label="Calls scheduled" value={form.calls_scheduled} onChange={setNum("calls_scheduled")} />
                  </div>
                </div>
              )}

              {!isCsm && (
                <div className="space-y-3">
                  <SectionLabel>Show outcomes</SectionLabel>
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
                    <SectionLabel>Closer — call activity</SectionLabel>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <NumField label="Calls taken" value={form.calls_taken} onChange={setNum("calls_taken")} />
                      <NumField label="Closes" value={form.closes} onChange={setNum("closes")} />
                      <NumField label="Deposits" value={form.deposits} onChange={setNum("deposits")} />
                      <NumField label="Follow-ups done" value={form.follow_ups_done} onChange={setNum("follow_ups_done")} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <SectionLabel>Closer — cash</SectionLabel>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Cash collected today ($)</Label>
                        <Input type="number" min={0} step="0.01" value={form.cash_collected} onChange={e => setFloat("cash_collected")(e.target.value)} onFocus={e => e.currentTarget.select()} className="bg-[#0a0b0f] border-[#1f2530] rounded-sm h-9 font-mono text-sm focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/40" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Deferred cash — PIF &lt;30d ($)</Label>
                        <Input type="number" min={0} step="0.01" value={form.deferred_cash} onChange={e => setFloat("deferred_cash")(e.target.value)} onFocus={e => e.currentTarget.select()} className="bg-[#0a0b0f] border-[#1f2530] rounded-sm h-9 font-mono text-sm focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/40" />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Deferred = PIF cash expected within 30 days per the EOD SOP.</p>
                  </div>
                </>
              )}

              <div className="space-y-3">
                <SectionLabel>Narrative</SectionLabel>
                {yesterday?.tomorrow_focus && !existingId && (
                  <div className="rounded-sm border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-[11px] text-sky-300 flex items-start gap-2">
                    <span className="text-[9px] uppercase tracking-wider text-sky-400 shrink-0 mt-0.5">Yesterday</span>
                    <span className="flex-1"><span className="text-muted-foreground">Tomorrow's focus was:</span> {yesterday.tomorrow_focus}</span>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, summary: f.summary || `Yesterday's focus: ${yesterday.tomorrow_focus}` }))}
                      className="text-[10px] text-sky-400 hover:text-sky-300 shrink-0"
                    >Use as start</button>
                  </div>
                )}
                <TextField label="Wins" value={form.wins} onChange={v => setForm(f => ({ ...f, wins: v }))} />
                <TextField label="Blockers" value={form.blockers} onChange={v => setForm(f => ({ ...f, blockers: v }))} />
                <TextField label="Tomorrow's focus" value={form.tomorrow_focus} onChange={v => setForm(f => ({ ...f, tomorrow_focus: v }))} />
                <TextField label="Summary" value={form.summary} onChange={v => setForm(f => ({ ...f, summary: v }))} rows={3} />
              </div>


              <div className="flex items-center justify-between pt-2 border-t border-[#1f2530]">
                <div className="text-[11px] text-muted-foreground">
                  Convos→Booked <span className="text-foreground font-mono ml-1">{conv}%</span>
                  <span className="mx-2 text-[#1f2530]">|</span>
                  Show rate <span className="text-foreground font-mono ml-1">{showRate}%</span>
                </div>
                <Button onClick={submit} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-medium h-8 rounded-sm text-xs">
                  {saving ? "Saving…" : existingId ? "Update EOD" : "Submit EOD"}
                </Button>
              </div>
            </div>

            <aside className="space-y-3">
              <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Today at a glance</div>
                {isCsm ? (
                  <>
                    <MiniStat label="Looms" value={form.looms_reviewed} highlight />
                    <MiniStat label="Roleplays" value={form.roleplays_reviewed} />
                    <MiniStat label="Check-ins" value={form.student_checkins} />
                    <MiniStat label="Escalations" value={form.escalations_resolved} />
                  </>
                ) : (
                  <>
                    <MiniStat label="DMs sent" value={form.dms_sent} />
                    <MiniStat label="Convos" value={form.convos_started} />
                    <MiniStat label="Booked" value={form.calls_booked} highlight />
                    <MiniStat label="Shows" value={form.shows} />
                    <MiniStat label="No-shows" value={form.no_shows} />
                  </>
                )}
              </div>
              <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-4 text-[11px] text-muted-foreground leading-relaxed">
                <div className="text-[10px] uppercase tracking-widest text-emerald-400 mb-2">Pro tip</div>
                Submit before <span className="text-foreground font-mono">23:59</span>. Missed days hurt the team's rolling average and your leaderboard rank.
              </div>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="mine">
          <div className="space-y-2">
            {myEods.length === 0 && <EmptyState text="No EODs yet. Submit your first one above." />}
            {myEods.map(e => <EODRow key={e.id} eod={e} onDelete={deleteEod} />)}
          </div>
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
            <div className="space-y-2">
              {teamEods.length === 0 && <EmptyState text="No team EODs yet." />}
              {teamEods.map(e => <EODRow key={e.id} eod={e} author={e.display_name} onDelete={roles.includes("admin") ? deleteEod : undefined} />)}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

type GridEod = EOD & { display_name?: string; primary_role?: string };
type RosterEntry = { user_id: string; display_name: string; primary_role: string };

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDayHeader(d: Date) {
  return `${WEEKDAY[d.getDay()]} ${d.getDate()}`;
}
function fmtLongDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${WEEKDAY[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`;
}

const ROLE_GROUPS: { key: string; label: string; roles: string[] }[] = [
  { key: "setters", label: "Setters", roles: ["setter"] },
  { key: "closers", label: "Closers", roles: ["closer"] },
  { key: "csm", label: "CSM", roles: ["csm"] },
  { key: "coaches", label: "Coaches", roles: ["coach"] },
];

function buildDayList(days: number): string[] {
  const list: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    list.push(d.toISOString().slice(0, 10));
  }
  return list.reverse(); // oldest → newest for reading L→R
}

function ComplianceMatrix({ eods, roster }: { eods: GridEod[]; roster: RosterEntry[] }) {
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const dayList = useMemo(() => buildDayList(days), [days]);
  const submittedSet = useMemo(() => {
    const s = new Set<string>();
    eods.forEach(e => s.add(`${e.user_id}::${e.report_date}`));
    return s;
  }, [eods]);

  const rowStats = (uid: string) => {
    // walk newest→oldest, skip Sundays, count consecutive submitted for streak
    let streak = 0;
    let stopped = false;
    let required = 0;
    let submitted = 0;
    const sorted = [...dayList].reverse();
    sorted.forEach((d, idx) => {
      const dt = new Date(d + "T00:00:00");
      if (dt.getDay() === 0) return; // Sunday not required
      required++;
      const hit = submittedSet.has(`${uid}::${d}`);
      if (hit) submitted++;
      if (!stopped) {
        // For streak: allow today missing (grace period) — start counting from most recent required day
        if (hit) streak++;
        else if (idx === 0) { /* today missing, don't break streak yet */ }
        else stopped = true;
      }
    });
    const pct = required ? Math.round((submitted / required) * 100) : 0;
    return { streak, submitted, required, pct };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-sm border border-border bg-card p-0.5">
          {[7, 14, 30].map(n => (
            <button
              key={n}
              onClick={() => setDays(n as 7 | 14 | 30)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-[2px] transition ${
                days === n ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >{n}D</button>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Green ✓ submitted · Red ✗ missed · Gray — not required (Sundays)
        </div>
      </div>

      <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1f2530] text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2 sticky left-0 bg-[#0f1116] z-10">Person</th>
              {dayList.map(d => {
                const dt = new Date(d + "T00:00:00");
                const isSun = dt.getDay() === 0;
                return (
                  <th key={d} className={`px-1.5 py-2 text-center font-normal whitespace-nowrap ${isSun ? "text-[#4a5060]" : ""}`}>
                    {fmtDayHeader(dt)}
                  </th>
                );
              })}
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
                  <tr className="bg-[#0a0b0f]">
                    <td colSpan={dayList.length + 3} className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {group.label} · {members.length}
                    </td>
                  </tr>
                  {members.map(m => {
                    const s = rowStats(m.user_id);
                    return (
                      <tr key={m.user_id} className="border-b border-[#1a1f29] last:border-0">
                        <td className="px-3 py-2 sticky left-0 bg-[#0f1116] font-medium truncate max-w-[180px]">
                          <div className="text-xs">{m.display_name}</div>
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{m.primary_role}</div>
                        </td>
                        {dayList.map(d => {
                          const dt = new Date(d + "T00:00:00");
                          const isSun = dt.getDay() === 0;
                          const hit = submittedSet.has(`${m.user_id}::${d}`);
                          if (isSun) {
                            return <td key={d} className="px-1 py-1 text-center"><span className="text-[#3a3f4a] text-[11px]">—</span></td>;
                          }
                          return (
                            <td key={d} className="px-1 py-1 text-center">
                              {hit ? (
                                <span title={`${m.display_name} · ${fmtLongDate(d)} · Submitted`} className="inline-flex items-center justify-center h-5 w-5 rounded-sm bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px]">✓</span>
                              ) : (
                                <span title={`${m.display_name} · ${fmtLongDate(d)} · Missed`} className="inline-flex items-center justify-center h-5 w-5 rounded-sm bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[11px]">✗</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          <span className={s.streak >= 3 ? "text-amber-400" : "text-foreground"}>{s.streak}</span>
                          <span className="text-muted-foreground text-[10px] ml-1">d</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs">
                          <span className={s.pct >= 90 ? "text-emerald-400" : s.pct >= 70 ? "text-amber-400" : "text-rose-400"}>{s.pct}%</span>
                          <span className="text-muted-foreground text-[10px] ml-1">({s.submitted}/{s.required})</span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
            {roster.length === 0 && (
              <tr><td colSpan={dayList.length + 3} className="p-8 text-center text-xs text-muted-foreground">No team members with a reporting role yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComplianceGraphs({ eods, roster }: { eods: GridEod[]; roster: RosterEntry[] }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const dayList = useMemo(() => buildDayList(days), [days]);

  const expectedPerDay = roster.length; // Mon–Sat all roles required
  const submissionsData = useMemo(() => {
    return dayList.map(d => {
      const dt = new Date(d + "T00:00:00");
      const isSun = dt.getDay() === 0;
      const submitted = eods.filter(e => e.report_date === d).length;
      return {
        date: d,
        label: fmtDayHeader(dt),
        submitted,
        expected: isSun ? 0 : expectedPerDay,
      };
    });
  }, [dayList, eods, expectedPerDay]);

  const funnelData = useMemo(() => {
    return dayList.map(d => {
      const dayEods = eods.filter(e => e.report_date === d);
      return {
        date: d,
        label: fmtDayHeader(new Date(d + "T00:00:00")),
        dms: dayEods.reduce((a, e) => a + (e.dms_sent ?? 0), 0),
        convos: dayEods.reduce((a, e) => a + (e.convos_started ?? 0), 0),
        booked: dayEods.reduce((a, e) => a + (e.calls_booked ?? 0), 0),
        shows: dayEods.reduce((a, e) => a + (e.shows ?? 0), 0),
      };
    });
  }, [dayList, eods]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-sm border border-border bg-card p-0.5">
          {[7, 30, 90].map(n => (
            <button
              key={n}
              onClick={() => setDays(n as 7 | 30 | 90)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-[2px] transition ${
                days === n ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >{n}D</button>
          ))}
        </div>
      </div>

      <GraphCard title="Reports submitted vs expected" subtitle="Sundays excluded from expected count">
        <SubmissionsChart data={submissionsData} />
      </GraphCard>

      <GraphCard title="Funnel volume — team total per day" subtitle="DMs · convos · booked · shows">
        <FunnelChart data={funnelData} />
      </GraphCard>
    </div>
  );
}

function GraphCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm p-4">
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
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2530" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8a91a0" }} />
        <YAxis tick={{ fontSize: 10, fill: "#8a91a0" }} allowDecimals={false} />
        <ReTooltip contentStyle={{ background: "#0f1116", border: "1px solid #1f2530", fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="expected" fill="#1f2530" name="Expected" />
        <Bar dataKey="submitted" fill="#10b981" name="Submitted" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FunnelChart({ data }: { data: { label: string; dms: number; convos: number; booked: number; shows: number }[] }) {
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2530" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8a91a0" }} />
        <YAxis tick={{ fontSize: 10, fill: "#8a91a0" }} allowDecimals={false} />
        <ReTooltip contentStyle={{ background: "#0f1116", border: "1px solid #1f2530", fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Line type="monotone" dataKey="dms" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="DMs" />
        <Line type="monotone" dataKey="convos" stroke="#a855f7" strokeWidth={1.5} dot={false} name="Convos" />
        <Line type="monotone" dataKey="booked" stroke="#10b981" strokeWidth={2} dot={false} name="Booked" />
        <Line type="monotone" dataKey="shows" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Shows" />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground border-b border-[#1f2530] pb-1.5">{children}</div>;
}

function WeekTile({ label, value, icon, accent }: { label: string; value: number | string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`border border-[#1f2530] rounded-sm p-2.5 ${accent ? "bg-emerald-500/5" : "bg-[#0f1116]"}`}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
        {icon}{label}
      </div>
      <div className={`text-lg font-mono font-semibold ${accent ? "text-emerald-400" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  const bump = (d: number) => onChange(String(Math.max(0, value + d)));
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => bump(-1)}
          className="h-9 w-8 rounded-sm border border-[#1f2530] bg-[#0a0b0f] hover:bg-[#1a1f29] text-lg leading-none"
        >−</button>
        <Input
          type="number"
          min={0}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={e => e.currentTarget.select()}
          className="bg-[#0a0b0f] border-[#1f2530] rounded-sm h-9 font-mono text-sm text-center focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/40"
        />
        <button
          type="button"
          onClick={() => bump(1)}
          className="h-9 w-8 rounded-sm border border-[#1f2530] bg-[#0a0b0f] hover:bg-[#1a1f29] text-lg leading-none"
        >+</button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="bg-[#0a0b0f] border-[#1f2530] rounded-sm text-sm focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/40 resize-none"
      />
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1a1f29] last:border-0 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${highlight ? "text-emerald-400 font-semibold" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="border border-dashed border-[#1f2530] rounded-sm p-8 text-center text-xs text-muted-foreground">{text}</div>;
}

function EODRow({ eod, author, onDelete }: { eod: EOD; author?: string; onDelete?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const conv = eod.convos_started > 0 ? Math.round((eod.calls_booked / eod.convos_started) * 100) : 0;
  return (
    <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm">
      <div className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#14171e] transition">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
          <div className="text-xs text-muted-foreground w-28">{fmtLongDate(eod.report_date)}</div>
          {author && <div className="text-xs text-foreground w-32 truncate">{author}</div>}
          <div className="flex-1 grid grid-cols-3 md:grid-cols-6 gap-2 text-[11px]">
            <RowStat label="DMs" value={eod.dms_sent} />
            <RowStat label="Convos" value={eod.convos_started} />
            <RowStat label="Booked" value={eod.calls_booked} accent />
            <RowStat label="Sched" value={eod.calls_scheduled} />
            <RowStat label="Shows" value={eod.shows} />
            <RowStat label={(eod.looms_reviewed || eod.roleplays_reviewed) ? "Looms" : "Conv%"} value={(eod.looms_reviewed || eod.roleplays_reviewed) ? eod.looms_reviewed : `${conv}%`} />
          </div>
        </button>
        {onDelete && (
          <button
            onClick={() => { if (confirm("Delete this EOD?")) onDelete(eod.id); }}
            className="p-1 rounded text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (eod.wins || eod.blockers || eod.tomorrow_focus || eod.summary) && (
        <div className="border-t border-[#1f2530] p-4 space-y-2 text-xs">
          {eod.wins && <p><span className="text-emerald-400">Wins:</span> {eod.wins}</p>}
          {eod.blockers && <p><span className="text-amber-400">Blockers:</span> {eod.blockers}</p>}
          {eod.tomorrow_focus && <p><span className="text-sky-400">Tomorrow:</span> {eod.tomorrow_focus}</p>}
          {eod.summary && <p className="text-muted-foreground italic">{eod.summary}</p>}
        </div>
      )}
    </div>
  );
}

function RowStat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono ${accent ? "text-emerald-400 font-semibold" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
