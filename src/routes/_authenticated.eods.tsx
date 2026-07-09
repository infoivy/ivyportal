import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, Clock, TrendingUp, Users, Phone, Target, AlertTriangle, ChevronRight, Trash2 } from "lucide-react";

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
  wins: string | null; blockers: string | null; tomorrow_focus: string | null; summary: string | null;
};

const emptyForm = {
  dms_sent: 0, convos_started: 0, calls_booked: 0, calls_scheduled: 0,
  shows: 0, no_shows: 0,
  wins: "", blockers: "", tomorrow_focus: "", summary: "",
};

function EODsPage() {
  const { user, roles } = useAuth();
  const canViewTeam = roles.includes("admin") || roles.includes("closer");
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState(emptyForm);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [myEods, setMyEods] = useState<EOD[]>([]);
  const [teamEods, setTeamEods] = useState<(EOD & { display_name?: string })[]>([]);
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
        wins: todayEod.wins ?? "", blockers: todayEod.blockers ?? "",
        tomorrow_focus: todayEod.tomorrow_focus ?? "", summary: todayEod.summary ?? "",
      });
    }
  };

  const loadTeam = async () => {
    const { data } = await supabase.from("eods").select("*").order("report_date", { ascending: false }).limit(50);
    const eods = (data ?? []) as EOD[];
    const userIds = Array.from(new Set(eods.map(e => e.user_id)));
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
    const nameMap = new Map(profiles?.map(p => [p.id, p.display_name]) ?? []);
    setTeamEods(eods.map(e => ({ ...e, display_name: nameMap.get(e.user_id) ?? "Unknown" })));
  };

  useEffect(() => { loadMine(); if (canViewTeam) loadTeam(); }, [user]);

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { user_id: user.id, report_date: today, ...form };
    const { error } = await supabase.from("eods").upsert(payload, { onConflict: "user_id,report_date" });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success(existingId ? "EOD updated" : "EOD submitted"); loadMine(); if (canViewTeam) loadTeam(); }
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

  // 7-day rolling summary for the current user
  const weekly = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const recent = myEods.filter(e => new Date(e.report_date) >= cutoff);
    const sum = (k: keyof EOD) => recent.reduce((a, e) => a + (Number(e[k]) || 0), 0);
    return {
      dms: sum("dms_sent"), convos: sum("convos_started"), booked: sum("calls_booked"),
      shows: sum("shows"), noshows: sum("no_shows"), submitted: recent.length,
    };
  }, [myEods]);

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
          <div className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-sm border ${existingId ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400" : "border-amber-500/30 bg-amber-500/5 text-amber-400"}`}>
            {existingId ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {existingId ? "Today submitted" : "Today pending"}
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">{today}</span>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <WeekTile label="7d DMs" value={weekly.dms} icon={<Users className="h-3 w-3" />} />
        <WeekTile label="7d Convos" value={weekly.convos} icon={<TrendingUp className="h-3 w-3" />} />
        <WeekTile label="7d Booked" value={weekly.booked} icon={<Phone className="h-3 w-3" />} accent />
        <WeekTile label="7d Shows" value={weekly.shows} icon={<Target className="h-3 w-3" />} />
        <WeekTile label="7d No-shows" value={weekly.noshows} icon={<AlertTriangle className="h-3 w-3" />} />
        <WeekTile label="Reports" value={`${weekly.submitted}/7`} icon={<CheckCircle2 className="h-3 w-3" />} />
      </div>

      <Tabs defaultValue="submit" className="space-y-4">
        <TabsList className="bg-[#0f1116] border border-[#1f2530] rounded-sm h-9 p-0.5">
          <TabsTrigger value="submit" className="text-xs h-8 rounded-sm data-[state=active]:bg-[#1a1f29]">Today's EOD</TabsTrigger>
          <TabsTrigger value="mine" className="text-xs h-8 rounded-sm data-[state=active]:bg-[#1a1f29]">My history</TabsTrigger>
          {canViewTeam && <TabsTrigger value="team" className="text-xs h-8 rounded-sm data-[state=active]:bg-[#1a1f29]">Team feed</TabsTrigger>}
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

              <div className="space-y-3">
                <SectionLabel>Funnel volume</SectionLabel>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <NumField label="DMs sent" value={form.dms_sent} onChange={setNum("dms_sent")} />
                  <NumField label="Convos started" value={form.convos_started} onChange={setNum("convos_started")} />
                  <NumField label="Calls booked" value={form.calls_booked} onChange={setNum("calls_booked")} />
                  <NumField label="Calls scheduled" value={form.calls_scheduled} onChange={setNum("calls_scheduled")} />
                </div>
              </div>

              <div className="space-y-3">
                <SectionLabel>Show outcomes</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <NumField label="Shows" value={form.shows} onChange={setNum("shows")} />
                  <NumField label="No-shows" value={form.no_shows} onChange={setNum("no_shows")} />
                </div>
              </div>

              <div className="space-y-3">
                <SectionLabel>Narrative</SectionLabel>
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
                <MiniStat label="DMs sent" value={form.dms_sent} />
                <MiniStat label="Convos" value={form.convos_started} />
                <MiniStat label="Booked" value={form.calls_booked} highlight />
                <MiniStat label="Shows" value={form.shows} />
                <MiniStat label="No-shows" value={form.no_shows} />
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
          <div className="text-xs font-mono text-muted-foreground w-24">{eod.report_date}</div>
          {author && <div className="text-xs text-foreground w-32 truncate">{author}</div>}
          <div className="flex-1 grid grid-cols-3 md:grid-cols-6 gap-2 text-[11px]">
            <RowStat label="DMs" value={eod.dms_sent} />
            <RowStat label="Convos" value={eod.convos_started} />
            <RowStat label="Booked" value={eod.calls_booked} accent />
            <RowStat label="Sched" value={eod.calls_scheduled} />
            <RowStat label="Shows" value={eod.shows} />
            <RowStat label="Conv%" value={`${conv}%`} />
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
