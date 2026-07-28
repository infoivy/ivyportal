import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateForTables } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, Clock, AlertTriangle, ChevronRight, ChevronDown, Flame } from "lucide-react";
import { computeStreak } from "@/lib/streak";
import { todayLocal } from "@/lib/dates";
import confetti from "canvas-confetti";
import { MochiEodReference } from "@/components/mochi-eod-reference";

export const Route = createFileRoute("/_authenticated/eods")({
  head: () => ({ meta: [{ title: "EOD Reports · ISA Team" }] }),
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

type SetterType = "phone" | "dm" | "full_cycle" | null;

// KPI defaults — plain numbers; adjust in Admin → Settings later
const KPI = {
  phone:      { primary: { key: "dials" as const, label: "Dials", target: 100 }, secondary: null, sets: 3 },
  // 2026-07-11 founder-approved: "leads contacted/outreached" folded into
  // "DMs sent" — same activity, one field. Historical rows keep
  // leads_contacted; readers take the max of both so old KPI days hold.
  dm:         { primary: { key: "dms_sent" as const, label: "DMs sent", target: 125 }, secondary: null, sets: 3 },
  // Full cycle does both: dials AND outreach must hit
  full_cycle: { primary: { key: "dials" as const, label: "Dials", target: 100 }, secondary: { key: "dms_sent" as const, label: "DMs sent", target: 50 }, sets: 3 },
};

const SETTER_TYPE_LABEL: Record<string, string> = { phone: "Phone setter", dm: "DM setter", full_cycle: "Full cycle" };

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

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const fmtLong = (iso: string) => { const d = new Date(iso + "T00:00:00"); return `${WEEKDAY[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`; };
// Noon anchor so the local calendar date survives UTC conversion in any timezone
const shiftDay = (iso: string, delta: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + delta); return new Intl.DateTimeFormat("en-CA").format(d); };
const startOfWeek = (iso: string) => { const d = new Date(iso + "T00:00:00"); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + diff); return isoDate(d); }; // Monday-start

function EODsPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles.includes("admin");
  const isCsm = roles.includes("csm");
  const isSetter = roles.includes("setter");
  const isCloser = roles.includes("closer") || roles.includes("coach");
  const filesEods = isSetter || isCloser || isCsm;
  const isFounder = isAdmin && !filesEods;
  const today = todayLocal();
  const yesterday = shiftDay(today, -1);

  // Which day this report is for. Reps who finish after midnight, or whose
  // device clock is off, still need an explicit Today or Yesterday choice.
  const [reportDate, setReportDate] = useState(today);

  const [form, setForm] = useState(emptyForm);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [myEods, setMyEods] = useState<EOD[]>([]);
  const [mySetterType, setMySetterType] = useState<SetterType>(null);
  const [csmTarget, setCsmTarget] = useState(10);
  const [saving, setSaving] = useState(false);
  const loadMine = useCallback(async () => {
    if (!user) return;
    const [{ data }, { data: prof }] = await Promise.all([
      supabase.from("eods").select("*").eq("is_demo", false).eq("user_id", user.id).order("report_date", { ascending: false }).limit(120),
      supabase.from("profiles").select("setter_type, csm_daily_target" as never).eq("id", user.id).maybeSingle(),
    ]);
    setMySetterType(((prof as { setter_type?: string } | null)?.setter_type ?? null) as SetterType);
    setCsmTarget(Number((prof as { csm_daily_target?: number } | null)?.csm_daily_target) || 10);
    const rows = (data ?? []) as EOD[];
    setMyEods(rows);
    const target = rows.find(e => e.report_date === reportDate);
    if (target) {
      setExistingId(target.id);
      setForm({
        dms_sent: target.dms_sent, convos_started: target.convos_started,
        calls_booked: target.calls_booked, calls_scheduled: target.calls_scheduled,
        shows: target.shows, no_shows: target.no_shows,
        looms_reviewed: target.looms_reviewed ?? 0, roleplays_reviewed: target.roleplays_reviewed ?? 0,
        student_checkins: target.student_checkins ?? 0, escalations_resolved: target.escalations_resolved ?? 0,
        calls_taken: target.calls_taken ?? 0, closes: target.closes ?? 0, deposits: target.deposits ?? 0,
        cash_collected: Number(target.cash_collected ?? 0), deferred_cash: Number(target.deferred_cash ?? 0),
        follow_ups_done: target.follow_ups_done ?? 0,
        dials: target.dials ?? 0, leads_contacted: target.leads_contacted ?? 0,
        wins: target.wins ?? "", blockers: target.blockers ?? "",
        tomorrow_focus: target.tomorrow_focus ?? "", summary: target.summary ?? "",
      });
    } else {
      setExistingId(null);
      let next = emptyForm;
      try { const raw = localStorage.getItem(`eod-draft:${user.id}:${reportDate}`); if (raw) next = { ...emptyForm, ...JSON.parse(raw) }; } catch {}
      setForm(next);
    }
  }, [user, reportDate]);

  useEffect(() => { void loadMine(); }, [loadMine]);

  // A tab left open across midnight would otherwise keep a date that is no
  // longer offered by the Today/Yesterday toggle.
  useEffect(() => {
    if (reportDate !== today && reportDate !== yesterday) setReportDate(today);
  }, [reportDate, today, yesterday]);

  // Autosave draft (restore happens in loadMine when no row exists for the date)
  const draftKey = user ? `eod-draft:${user.id}:${reportDate}` : null;
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (!draftKey || existingId) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(form)); setDraftSavedAt(new Date()); } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [form, draftKey, existingId]);

  const saveSetterType = async (t: SetterType) => {
    if (!user) return;
    setMySetterType(t);
    await supabase.from("profiles").update({ setter_type: t } as never).eq("id", user.id);
  };

  const submit = async () => {
    if (!user) return;
    if (existingId) return toast.error("Submitted reports are locked. Contact a founder if a correction is needed.");
    if (!form.wins.trim()) return toast.error("Add a wins / summary before submitting.");
    const cleaned = isCsm
      ? { ...form, dms_sent: 0, convos_started: 0, calls_booked: 0, calls_scheduled: 0, shows: 0, no_shows: 0, calls_taken: 0, closes: 0, deposits: 0, cash_collected: 0, deferred_cash: 0, follow_ups_done: 0, dials: 0, leads_contacted: 0 }
      : form;

    const warnings: string[] = [];
    if (isSetter) {
      if (cleaned.calls_booked > cleaned.convos_started && cleaned.convos_started > 0)
        warnings.push(`${cleaned.calls_booked} booked but only ${cleaned.convos_started} convos · sure?`);
      if ((cleaned.shows + cleaned.no_shows) > cleaned.calls_booked && cleaned.calls_booked > 0)
        warnings.push(`Shows + no-shows (${cleaned.shows + cleaned.no_shows}) exceeds calls booked (${cleaned.calls_booked}).`);
    }
    if (warnings.length && !confirm(warnings.join("\n") + "\n\nSubmit anyway?")) return;

    setSaving(true);
    const payload = { user_id: user.id, report_date: reportDate, ...cleaned };
    const { error } = await supabase.from("eods").insert(payload);
    setSaving(false);
    if (error?.code === "23505") {
      void loadMine();
      return toast.error("An EOD is already submitted for this date. Submitted reports are locked.");
    }
    if (error) return toast.error(error.message);
    toast.success(`EOD submitted for ${fmtLong(reportDate)}`);
    // Clears the "EOD due" chip in the top bar without a reload
    if (reportDate === today) {
      window.dispatchEvent(new CustomEvent("isa:eod-submitted", { detail: { userId: user.id } }));
    }
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 }, colors: ["#171717", "#525252", "#A3A3A3", "#F5F5F5"] });
    if (draftKey) { try { localStorage.removeItem(draftKey); } catch {} }
    void loadMine();
    // Sales HQ tiles, admin counts, dashboard nudges, and the team board all
    // read eods — refresh them everywhere, not just this page.
    invalidateForTables(qc, ["eods"]);
  };


  const setNum = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: parseInt(v) || 0 }));
  const setFloat = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: parseFloat(v) || 0 }));

  // My-week (personal) numbers
  const myWeek = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const recent = myEods.filter(e => new Date(e.report_date) >= cutoff);
    const sum = (k: keyof EOD) => recent.reduce((a, e) => a + (Number(e[k]) || 0), 0);
    const kpiHitDays = recent.filter(e =>
      mySetterType ? didHitKpi(e, mySetterType) : isCsm ? didHitCsmKpi(e, csmTarget) : false,
    ).length;
    return { submitted: recent.length, kpiHitDays,
      dials: sum("dials"), leads: recent.reduce((a, e) => a + outreachOf(e), 0), sets: sum("calls_booked"),
      shows: sum("shows"), cash: sum("cash_collected"), closes: sum("closes") };
  }, [myEods, mySetterType, isCsm, csmTarget]);
  const streak = useMemo(() => computeStreak(myEods.map(e => e.report_date)), [myEods]);

  const kpi = mySetterType ? KPI[mySetterType] : null;
  const primaryVal = mySetterType === "dm" ? form.dms_sent : form.dials;
  // full_cycle primary = dials; its outreach bar reads form.dms_sent directly

  const defaultTab = "submit";

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 pb-5 mb-1">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Performance</div>
          <h1 className="mt-2 text-[28px] sm:text-[34px] font-semibold tracking-tight leading-[1.12] text-foreground">End of day</h1>
          <p className="text-[15px] text-muted-foreground mt-1.5">Submit today's report. Performance now lives in its own workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isFounder && (() => {
            const todaySubmitted = myEods.some(e => e.report_date === today);
            return (
              <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm border ${todaySubmitted ? "border-success/25 bg-success-bg text-success-fg" : "border-warning/25 bg-warning-bg text-warning-fg"}`}>
                {todaySubmitted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                {todaySubmitted ? "Today submitted" : "Today pending"}
              </div>
            );
          })()}
          <span className="text-[11px] text-muted-foreground">{fmtLong(today)}</span>
          <Button asChild variant="outline" size="sm">
            <Link to={"/performance" as never}>View Performance</Link>
          </Button>
        </div>
      </header>

      {filesEods && (
        <div className="card-surface p-3">
          <div className="text-[13px] text-muted-foreground mb-2">My week (last 7 days)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MiniChip label="Streak" value={`${streak}d`} tone="amber" icon={<Flame className="h-3 w-3" />} />
            <MiniChip label="Reports" value={`${myWeek.submitted}/7`} />
            <MiniChip label="KPI hit" value={`${myWeek.kpiHitDays}/7`} />
            {isSetter && mySetterType === "dm" ? (
              <MiniChip label="Leads" value={myWeek.leads} />
            ) : isSetter ? (
              <MiniChip label="Dials" value={myWeek.dials} />
            ) : isCloser ? (
              <MiniChip label="Cash" value={`$${Math.round(myWeek.cash).toLocaleString()}`} />
            ) : (
              <MiniChip label="Sets" value={myWeek.sets} />
            )}
          </div>
        </div>
      )}

      {isFounder && (
        <div className="card-surface px-4 py-3 text-[13px] text-muted-foreground">
          This account has no reporting role. Open Performance to review submitted team activity.
        </div>
      )}

      {!isFounder && <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="bg-[var(--card)] border border-[var(--border)] rounded-sm h-auto min-h-9 p-0.5 flex-wrap">
          {!isFounder && <TabsTrigger value="submit" className="text-xs h-8 rounded-sm data-[state=active]:bg-[var(--accent)]">My EOD</TabsTrigger>}
          {!isFounder && <TabsTrigger value="mine" className="text-xs h-8 rounded-sm data-[state=active]:bg-[var(--accent)]">My history</TabsTrigger>}
        </TabsList>

        <TabsContent value="submit" className="space-y-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 border border-[var(--border)] bg-[var(--card)] rounded-sm p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">{existingId ? "Submitted and locked" : "Submit numbers"} · {fmtLong(reportDate)}
                    {!existingId && draftSavedAt && (
                      <span className="ml-2 text-[10px] font-normal text-muted-foreground">Draft saved ✓</span>
                    )}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {existingId ? "Submitted reports are locked. Contact a founder if a correction is needed." : "Zero is a valid answer."}
                  </p>
                </div>
                <div className="inline-flex rounded-sm border border-[var(--border)] bg-[var(--background)] p-0.5">
                  {[{ d: today, label: "Today" }, { d: yesterday, label: "Yesterday" }].map(o => (
                    <button
                      key={o.d}
                      type="button"
                      onClick={() => setReportDate(o.d)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-sm motion-safe:transition-colors ${reportDate === o.d ? "bg-[var(--accent)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >{o.label}</button>
                  ))}
                </div>
              </div>

              <fieldset disabled={Boolean(existingId)} className={`m-0 min-w-0 border-0 p-0 ${existingId ? "space-y-5 opacity-70" : "space-y-5"}`}>
              {isSetter && !mySetterType && (
                <div className="rounded-sm border border-warning/25 bg-warning-bg p-3">
                  <div className="text-[11px] text-warning-fg mb-2">Pick your setter type · this drives your daily KPI.</div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => saveSetterType("phone")}>Phone setter</Button>
                    <Button size="sm" variant="outline" onClick={() => saveSetterType("dm")}>DM setter</Button>
                    <Button size="sm" variant="outline" onClick={() => saveSetterType("full_cycle")}>Full cycle</Button>
                  </div>
                </div>
              )}

              {isSetter && kpi && (
                <div className="rounded-sm border border-[var(--border)] bg-[var(--background)] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] text-muted-foreground">Today's KPI ({SETTER_TYPE_LABEL[mySetterType ?? ""] ?? "Setter"})</div>
                    <button className="text-[10px] text-muted-foreground hover:text-foreground underline" onClick={() => saveSetterType(mySetterType === "phone" ? "dm" : mySetterType === "dm" ? "full_cycle" : "phone")}>Switch type</button>
                  </div>
                  <div className={`grid gap-3 ${kpi.secondary ? "grid-cols-3" : "grid-cols-2"}`}>
                    <KpiBar label={kpi.primary.label} value={primaryVal} target={kpi.primary.target} />
                    {kpi.secondary && <KpiBar label={kpi.secondary.label} value={form.dms_sent} target={kpi.secondary.target} />}
                    <KpiBar label="Calls booked (sets)" value={form.calls_booked} target={kpi.sets} />
                  </div>
                </div>
              )}

              {isSetter && (
                <div className="space-y-3">
                  <SectionLabel>Setting activity</SectionLabel>
                  <MochiEodReference
                    values={{ dms_sent: form.dms_sent, calls_booked: form.calls_booked }}
                    onApply={(field, value) => setNum(field)(String(value))}
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(mySetterType === "phone" || mySetterType === "full_cycle" || !mySetterType) && (
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
                  <div className="rounded-sm border border-[var(--border)] bg-[var(--background)] p-3">
                    <div className="text-[11px] text-muted-foreground mb-2">Today's KPI · students reached</div>
                    <KpiBar label="Student check-ins" value={form.student_checkins} target={csmTarget} />
                  </div>
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
                        <Label className="text-[13px] text-muted-foreground">Cash collected today ($)</Label>
                        <Input type="number" min={0} step="0.01" value={form.cash_collected} onChange={e => setFloat("cash_collected")(e.target.value)} onFocus={e => e.currentTarget.select()} className="bg-[var(--background)] border-[var(--border)] rounded-sm h-9 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[13px] text-muted-foreground">Deferred cash · PIF &lt;30d ($)</Label>
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
                <Button onClick={submit} disabled={saving || Boolean(existingId)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-8 rounded-sm text-xs">
                  {saving ? "Saving…" : existingId ? "Submitted and locked" : "Submit EOD"}
                </Button>
              </div>
              </fieldset>
            </div>

            <aside className="space-y-3">
              <MyLast7Panel myEods={myEods} today={today} setterType={mySetterType} csmTarget={isCsm ? csmTarget : null} />
              <div className="card-surface p-4 text-[13px] text-muted-foreground leading-relaxed">
                <div className="text-[13px] font-medium text-primary mb-2">Pro tip</div>
                Submit before <span className="text-foreground">23:59</span>. Missed days hurt the team's rolling average.
              </div>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="mine">
          <MyHistory myEods={myEods} setterType={mySetterType} isSetter={isSetter} isCloser={isCloser} csmTarget={isCsm ? csmTarget : null} />
        </TabsContent>

      </Tabs>}
    </div>
  );
}

// ---------- KPI logic ----------

/** Outreach volume with legacy fallback: pre-2026-07-11 rows logged it as leads_contacted. */
function outreachOf(e: EOD): number {
  return Math.max(e.dms_sent ?? 0, e.leads_contacted ?? 0);
}

function didHitKpi(e: EOD, st: SetterType): boolean {
  if (!st) return false;
  const cfg = KPI[st];
  const read = (k: keyof EOD) => (k === "dms_sent" ? outreachOf(e) : ((e[k] ?? 0) as number));
  // Founder rule 2026-07-14: SETS are the KPI. 3+ sets = KPI met regardless of
  // volume. Couldn't hit sets? Full volume (100 dials / 125 DMs / both for
  // full-cycle) still counts as a KPI day.
  if ((e.calls_booked ?? 0) >= cfg.sets) return true;
  if (read(cfg.primary.key) < cfg.primary.target) return false;
  if (cfg.secondary && read(cfg.secondary.key) < cfg.secondary.target) return false;
  return true;
}

/** CSM KPI: daily student check-ins against their personal target
 *  (profiles.csm_daily_target — part-time vs full-time, founder-set). A
 *  submitted EOD with 0 check-ins must NOT read as green (founder-reported
 *  2026-07-28). */
function didHitCsmKpi(e: EOD, target: number | null | undefined): boolean {
  return (e.student_checkins ?? 0) >= Math.max(1, Number(target) || 10);
}

function dayStatus(e: EOD | undefined, st: SetterType, csmTarget?: number | null): "green" | "amber" | "red" {
  if (!e) return "red";
  if (st) return didHitKpi(e, st) ? "green" : "amber";
  if (csmTarget != null) return didHitCsmKpi(e, csmTarget) ? "green" : "amber";
  return "green"; // no KPI defined (closer/coach)
}

// ---------- My history (grouped by week) ----------

function MyHistory({ myEods, setterType, isSetter, isCloser, csmTarget = null }: { myEods: EOD[]; setterType: SetterType; isSetter: boolean; isCloser: boolean; csmTarget?: number | null }) {
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
        const leads = rows.reduce((a, e) => a + outreachOf(e), 0);
        const sets = rows.reduce((a, e) => a + e.calls_booked, 0);
        const cash = rows.reduce((a, e) => a + Number(e.cash_collected ?? 0), 0);
        const checkins = rows.reduce((a, e) => a + (e.student_checkins ?? 0), 0);
        const kpiDays = rows.filter(e => setterType ? didHitKpi(e, setterType) : csmTarget != null ? didHitCsmKpi(e, csmTarget) : false).length;
        return (
          <div key={wk} className="border border-[var(--border)] bg-[var(--card)] rounded-sm">
            <button onClick={() => toggle(wk)} className="w-full flex items-center justify-between p-3 text-left hover:bg-[var(--muted)]">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span className="text-sm font-semibold">Week of {fmtLong(wk)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground flex gap-3 flex-wrap justify-end">
                <span>{submitted}/7 submitted</span>
                {isSetter && (setterType === "dm" ? <span>{leads} DMs</span> : <span>{dials} dials</span>)}
                {isSetter && <span>{sets} sets</span>}
                {isCloser && <span>${Math.round(cash).toLocaleString()} cash</span>}
                {csmTarget != null && <span>{checkins} check-ins</span>}
                {(setterType || csmTarget != null) && <span className={kpiDays >= 5 ? "text-success-fg" : "text-warning-fg"}>KPI {kpiDays} of {submitted}</span>}
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-[var(--border)]">
                {rows.sort((a, b) => b.report_date.localeCompare(a.report_date)).map(e => (
                  <HistoryDayRow key={e.id} eod={e} setterType={setterType} isSetter={isSetter} isCloser={isCloser} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HistoryDayRow({ eod, setterType, isSetter, isCloser }: { eod: EOD; setterType: SetterType; isSetter: boolean; isCloser: boolean }) {
  const [open, setOpen] = useState(false);
  const kpi = setterType ? didHitKpi(eod, setterType) : null;
  const dotClass = kpi === null ? "bg-muted" : kpi ? "bg-success" : "bg-warning";
  const rawConv = eod.convos_started > 0 ? (eod.calls_booked / eod.convos_started) * 100 : 0;
  const dataError = eod.calls_booked > eod.convos_started && eod.convos_started > 0;
  const convDisplay = Math.min(100, Math.round(rawConv));

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
        {dataError && <span className="text-[10px] text-warning-fg flex items-center gap-1 shrink-0"><AlertTriangle className="h-3 w-3" /> data error</span>}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 text-xs bg-[var(--background)]">
          {dataError && <div className="text-warning-fg text-[11px]">⚠ Booked exceeds convos. This submitted report stays locked; contact a founder to record the issue.</div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <RowStat label="DMs" value={eod.dms_sent} />
            <RowStat label="Convos" value={eod.convos_started} />
            <RowStat label="Booked" value={eod.calls_booked} />
            <RowStat label="Scheduled" value={eod.calls_scheduled} />
            <RowStat label="Shows" value={eod.shows} />
            <RowStat label="No-shows" value={eod.no_shows} />
          </div>
          {eod.wins && <p><span className="text-success-fg">Wins:</span> {eod.wins}</p>}
          {eod.blockers && <p><span className="text-warning-fg">Blockers:</span> {eod.blockers}</p>}
          {(eod.summary || eod.tomorrow_focus) && <p className="text-muted-foreground italic">{eod.summary || eod.tomorrow_focus}</p>}

        </div>
      )}
    </div>
  );
}

// ---------- Personal last-7 panel ----------

function MyLast7Panel({ myEods, today, setterType, csmTarget = null }: { myEods: EOD[]; today: string; setterType: SetterType; csmTarget?: number | null }) {
  const days = useMemo(() => { const list: string[] = []; const t = new Date(today + "T00:00:00"); for (let i = 6; i >= 0; i--) { const d = new Date(t); d.setDate(t.getDate() - i); list.push(isoDate(d)); } return list; }, [today]);
  const byDate = new Map(myEods.map(e => [e.report_date, e]));
  return (
    <div className="card-surface p-4">
      <div className="text-[13px] text-muted-foreground mb-3">My last 7 days</div>
      <div className="space-y-1.5 text-xs">
        {days.map(d => {
          const e = byDate.get(d);
          const status = dayStatus(e, setterType, csmTarget);
          const glyph = !e ? "✗" : status === "amber" ? "!" : "✓";
          const cls = !e ? "text-danger-fg" : status === "amber" ? "text-warning-fg" : "text-success-fg";
          return (<div key={d} className="flex items-center justify-between"><span className="text-muted-foreground">{fmtLong(d)}</span><span className={`text-[11px] ${cls}`}>{glyph}</span></div>);
        })}
      </div>
    </div>
  );
}

// ---------- Small parts ----------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-medium text-muted-foreground border-b border-[var(--border)] pb-1.5">{children}</div>;
}

function MiniChip({ label, value, tone, icon }: { label: string; value: number | string; tone?: "amber" | "default"; icon?: React.ReactNode }) {
  const valueColor = tone === "amber" ? "text-warning-fg" : "text-foreground";
  return (
    <div className="card-surface p-2">
      <div className="flex items-center gap-1 text-[12px] text-muted-foreground mb-0.5">{icon}{label}</div>
      <div className={`text-[18px] font-semibold tabular-nums ${valueColor}`}>{value}</div>
    </div>
  );
}

function KpiBar({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = Math.min(100, target ? Math.round((value / target) * 100) : 0);
  const hit = value >= target;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-[13px] text-muted-foreground truncate">{label}</span>
        <span className={`text-[11px] shrink-0 whitespace-nowrap ${hit ? "text-success-fg font-semibold" : "text-foreground"}`}>{value} / {target}</span>
      </div>
      <div className="h-1.5 bg-[var(--accent)] rounded-sm overflow-hidden">
        <div className={`h-full ${hit ? "bg-success" : "bg-warning"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  // Draft string so the field can sit empty while typing — a controlled
  // number value snaps "" back to 0 and backspace can never clear it.
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    // Sync external changes (steppers, "use" buttons, draft restore) without
    // fighting an in-progress edit like an empty field.
    if ((parseInt(draft) || 0) !== value) setDraft(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const bump = (d: number) => onChange(String(Math.max(0, value + d)));
  return (
    <div className="space-y-1">
      <Label className="text-[13px] text-muted-foreground">{label}</Label>
      {/* One joined control — floating −/+ buttons read as clutter */}
      <div className="flex h-9 items-stretch rounded-md border border-input bg-[var(--background)] overflow-hidden focus-within:border-ring">
        <button
          type="button"
          onClick={() => bump(-1)}
          aria-label={`Decrease ${label}`}
          className="w-9 shrink-0 grid place-items-center text-sm text-muted-foreground hover:text-foreground hover:bg-muted motion-safe:transition-colors border-r border-input/60"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          onChange={e => {
            // Digits only, no leading zeros — type="number" fights the caret
            // and renders things like "030" that backspace can't clean up.
            const clean = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
            setDraft(clean);
            onChange(clean);
          }}
          onBlur={() => setDraft(String(value))}
          onFocus={e => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent text-sm text-center tabular-nums outline-none"
        />
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label={`Increase ${label}`}
          className="w-9 shrink-0 grid place-items-center text-sm text-muted-foreground hover:text-foreground hover:bg-muted motion-safe:transition-colors border-l border-input/60"
        >
          +
        </button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[13px] text-muted-foreground">{label}</Label>
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
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className={`${accent ? "text-success-fg font-semibold" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
