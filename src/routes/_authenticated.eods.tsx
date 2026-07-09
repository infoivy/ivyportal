import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

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

  const setNum = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: parseInt(v) || 0 }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">EOD Reports</h1>
      <Tabs defaultValue="submit">
        <TabsList>
          <TabsTrigger value="submit">Today's EOD</TabsTrigger>
          <TabsTrigger value="mine">My history</TabsTrigger>
          {canViewTeam && <TabsTrigger value="team">Team feed</TabsTrigger>}
        </TabsList>

        <TabsContent value="submit">
          <Card>
            <CardHeader>
              <CardTitle>{existingId ? "Update today's EOD" : "Submit today's EOD"}</CardTitle>
              <p className="text-sm text-muted-foreground">{today}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <NumField label="DMs sent" value={form.dms_sent} onChange={setNum("dms_sent")} />
                <NumField label="Convos started" value={form.convos_started} onChange={setNum("convos_started")} />
                <NumField label="Calls booked" value={form.calls_booked} onChange={setNum("calls_booked")} />
                <NumField label="Calls scheduled" value={form.calls_scheduled} onChange={setNum("calls_scheduled")} />
                <NumField label="Shows" value={form.shows} onChange={setNum("shows")} />
                <NumField label="No-shows" value={form.no_shows} onChange={setNum("no_shows")} />
              </div>
              <TextField label="Wins" value={form.wins} onChange={v => setForm(f => ({ ...f, wins: v }))} />
              <TextField label="Blockers" value={form.blockers} onChange={v => setForm(f => ({ ...f, blockers: v }))} />
              <TextField label="Tomorrow's focus" value={form.tomorrow_focus} onChange={v => setForm(f => ({ ...f, tomorrow_focus: v }))} />
              <TextField label="Summary" value={form.summary} onChange={v => setForm(f => ({ ...f, summary: v }))} rows={4} />
              <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : existingId ? "Update EOD" : "Submit EOD"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mine">
          <div className="space-y-3">
            {myEods.length === 0 && <p className="text-muted-foreground">No EODs yet.</p>}
            {myEods.map(e => <EODCard key={e.id} eod={e} />)}
          </div>
        </TabsContent>

        {canViewTeam && (
          <TabsContent value="team">
            <div className="space-y-3">
              {teamEods.map(e => <EODCard key={e.id} eod={e} author={e.display_name} />)}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function TextField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} />
    </div>
  );
}

function EODCard({ eod, author }: { eod: EOD; author?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base">{eod.report_date}{author && <span className="text-muted-foreground font-normal"> · {author}</span>}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          <Stat label="DMs" value={eod.dms_sent} />
          <Stat label="Convos" value={eod.convos_started} />
          <Stat label="Booked" value={eod.calls_booked} />
          <Stat label="Sched" value={eod.calls_scheduled} />
          <Stat label="Shows" value={eod.shows} />
          <Stat label="No-shows" value={eod.no_shows} />
        </div>
        {eod.wins && <p><span className="text-muted-foreground">Wins:</span> {eod.wins}</p>}
        {eod.blockers && <p><span className="text-muted-foreground">Blockers:</span> {eod.blockers}</p>}
        {eod.tomorrow_focus && <p><span className="text-muted-foreground">Tomorrow:</span> {eod.tomorrow_focus}</p>}
        {eod.summary && <p className="text-muted-foreground italic">{eod.summary}</p>}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="bg-muted rounded p-2 text-center"><div className="font-bold">{value}</div><div className="text-muted-foreground">{label}</div></div>;
}
