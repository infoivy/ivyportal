import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Sparkles, Calendar as CalendarIcon, Columns3, List as ListIcon, Lightbulb,
  Plus, ExternalLink, Trash2, X, ArrowRight, Loader2, Instagram, LayoutGrid,
  BookOpen, Video, Zap,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { WeeklyPlan } from "@/components/weekly-plan";
import { FounderSops } from "@/components/founder-sops";
import { RecordingDay } from "@/components/recording-day";
import { HookLibrary } from "@/components/hook-library";
import { DateField } from "@/components/ui/date-field";
import { SelectField } from "@/components/ui/select-field";


type Platform = "instagram" | "tiktok" | "youtube" | "twitter" | "linkedin" | "threads" | "other";
type Status = "idea" | "scripted" | "approved" | "recorded" | "filmed" | "edited" | "scheduled" | "posted";

// Shared creative-type vocabulary. Must stay in sync with src/components/weekly-plan.tsx.
export const CREATIVE_TYPES = [
  "Talking head",
  "Pick up the phone angle",
  "Side angle",
  "Miro board walkthrough",
  "Ceiling angle",
  "Prestigious background",
  "Vlog style",
];

type ContentItem = {
  id: string;
  created_by: string;
  scheduled_date: string | null;
  platform: Platform;
  format: string | null;
  hook: string;
  title: string | null;
  script: string | null;
  status: Status;
  link_when_posted: string | null;
  tags: string[];
  posted_at: string | null;
  recorded_at: string | null;
  edited_at: string | null;
  raw_video_url: string | null;
  edited_reel_url: string | null;
  source: string | null;
  duration_sec: number | null;
  platforms: string[];
  reedit_flag: boolean;
  created_at: string;
  updated_at: string;
};

type Idea = {
  id: string;
  created_by: string;
  text: string;
  link: string | null;
  promoted_item_id: string | null;
  created_at: string;
  trigger_type: string | null;
  explanation: string | null;
  funnel_guess: string | null;
  harvested: boolean;
};

export const TRIGGERS: { value: string; label: string; hint: string }[] = [
  { value: "student_win",   label: "Student win",     hint: "A student result / breakthrough" },
  { value: "client_call",   label: "Client call",     hint: "Something said on a call today" },
  { value: "objection",     label: "Objection",       hint: "A repeated pushback / doubt" },
  { value: "market_signal", label: "Market signal",   hint: "Something happening in the niche" },
];

const PLATFORMS: { value: Platform; label: string; color: string }[] = [
  { value: "instagram", label: "IG",       color: "bg-muted text-muted-foreground border-border" },
  { value: "tiktok",    label: "TikTok",   color: "bg-muted text-muted-foreground border-border" },
  { value: "youtube",   label: "YT",       color: "bg-danger-bg text-danger-fg border-danger/25" },
  { value: "twitter",   label: "X",        color: "bg-slate-500/10 text-muted-foreground border-border" },
  { value: "linkedin",  label: "LinkedIn", color: "bg-muted text-muted-foreground border-border" },
  { value: "threads",   label: "Threads",  color: "bg-muted text-muted-foreground border-border" },
  { value: "other",     label: "Other",    color: "bg-neutral-500/10 text-neutral-300 border-neutral-500/30" },
];
const PLATFORM_META = Object.fromEntries(PLATFORMS.map(p => [p.value, p])) as Record<Platform, typeof PLATFORMS[number]>;

const STATUSES: { value: Status; label: string; color: string }[] = [
  { value: "idea",      label: "Idea",      color: "bg-neutral-500/10 text-neutral-300 border-neutral-500/30" },
  { value: "scripted",  label: "Scripted",  color: "bg-warning-bg text-warning-fg border-warning/25" },
  { value: "approved",  label: "Approved",  color: "bg-warning-bg text-warning-fg border-warning/25" },
  { value: "recorded",  label: "Recorded",  color: "bg-muted text-muted-foreground border-border" },
  { value: "filmed",    label: "Filmed",    color: "bg-muted text-muted-foreground border-border" }, // legacy alias
  { value: "edited",    label: "Edited",    color: "bg-muted text-muted-foreground border-border" },
  { value: "scheduled", label: "Scheduled", color: "bg-muted text-muted-foreground border-border" },
  { value: "posted",    label: "Posted",    color: "bg-success-bg text-success-fg border-success/25" },
];
const STATUS_META = Object.fromEntries(STATUSES.map(s => [s.value, s])) as Record<Status, typeof STATUSES[number]>;

const MULTI_PLATFORMS: { value: string; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok",    label: "TikTok" },
  { value: "youtube",   label: "YouTube" },
];

export function FounderPageContent() {
  const { user } = useAuth();

  const [items, setItems] = useState<ContentItem[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [view, setView] = useState<"weekly" | "recording" | "hooks" | "calendar" | "kanban" | "list" | "sops">("weekly");
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [promotingIdea, setPromotingIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [ci, ii] = await Promise.all([
      supabase.from("content_items").select("*").order("scheduled_date", { ascending: true, nullsFirst: false }),
      supabase.from("content_ideas").select("*").order("created_at", { ascending: false }),
    ]);
    setItems((ci.data ?? []) as ContentItem[]);
    setIdeas((ii.data ?? []) as Idea[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-foreground">Content & Strategy</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">Plan, script, record, post.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/instagram"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border)] bg-card hover:bg-muted text-[13px] motion-safe:transition-colors"
          >
            <Instagram className="h-3.5 w-3.5 text-muted-foreground" /> IG Analytics
          </Link>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[13px] font-medium motion-safe:transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New content
          </button>
        </div>
      </header>

      {/* Content pipeline health strip */}
      <ContentHealthStrip items={items} />

      {/* View switcher */}
      <div className="flex items-center gap-0.5 border-b border-[var(--border)] overflow-x-auto">
        <ViewTab active={view === "weekly"}    onClick={() => setView("weekly")}    icon={LayoutGrid}   label="Weekly plan" />
        <ViewTab active={view === "recording"} onClick={() => setView("recording")} icon={Video}        label="Recording day" />
        <ViewTab active={view === "hooks"}     onClick={() => setView("hooks")}     icon={Zap}          label="Hook library" />
        <ViewTab active={view === "calendar"}  onClick={() => setView("calendar")}  icon={CalendarIcon} label="Calendar" />
        <ViewTab active={view === "kanban"}    onClick={() => setView("kanban")}    icon={Columns3}     label="Kanban" />
        <ViewTab active={view === "list"}      onClick={() => setView("list")}      icon={ListIcon}     label="List" />
        <ViewTab active={view === "sops"}      onClick={() => setView("sops")}      icon={BookOpen}     label="SOPs & Playbooks" />
      </div>

      {view === "sops" ? (
        <FounderSops />
      ) : view === "hooks" ? (
        <HookLibrary />
      ) : view === "recording" ? (
        <RecordingDay
          onOpenItem={(id) => {
            const it = items.find(i => i.id === id);
            if (it) setEditing(it);
            else supabase.from("content_items").select("*").eq("id", id).maybeSingle().then(({ data }) => { if (data) setEditing(data as ContentItem); });
          }}
        />
      ) : view === "weekly" ? (
        <WeeklyPlan
          onOpenItem={(id) => {
            const it = items.find(i => i.id === id);
            if (it) setEditing(it);
            else {
              // item may have just been provisioned server-side; refetch and open after
              supabase.from("content_items").select("*").eq("id", id).maybeSingle().then(({ data }) => {
                if (data) setEditing(data as ContentItem);
              });
            }
          }}
        />
      ) : loading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div>
            {view === "calendar" && <CalendarView items={items} monthCursor={monthCursor} setMonthCursor={setMonthCursor} onOpen={setEditing} />}
            {view === "kanban"   && <KanbanView items={items} onOpen={setEditing} onUpdate={load} />}
            {view === "list"     && <ListView items={items} onOpen={setEditing} />}
          </div>

          {/* Idea inbox */}
          <aside>
            <IdeaInbox
              ideas={ideas}
              userId={user?.id ?? null}
              onChange={load}
              onPromote={(idea) => { setPromotingIdea(idea); setCreating(true); }}
            />
          </aside>
        </div>
      )}

      {(creating || editing) && (
        <ItemDialog
          initial={editing}
          userId={user?.id ?? null}
          onClose={() => { setCreating(false); setEditing(null); setPromotingIdea(null); }}
          onSaved={load}
          promotingIdea={promotingIdea}
        />
      )}
    </div>
  );

}

// -- View tabs --
function ContentHealthStrip({ items }: { items: ContentItem[] }) {
  // Current 2-week cycle: find the most recent Mon that is ≤ today
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const dayOfWeek = today.getDay(); // 0=Sun
  const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const cycleStart = new Date(today);
  cycleStart.setDate(today.getDate() - daysToMon);
  // Align to 2-week batches from a fixed epoch (2024-01-01 is a Monday)
  const epochMon = new Date("2024-01-01");
  const diffDays = Math.floor((cycleStart.getTime() - epochMon.getTime()) / 86400000);
  const batchOffset = diffDays % 14;
  cycleStart.setDate(cycleStart.getDate() - batchOffset);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setDate(cycleStart.getDate() + 13);
  const cycleStartStr = cycleStart.toISOString().slice(0, 10);
  const cycleEndStr = cycleEnd.toISOString().slice(0, 10);

  // Next Thursday
  const nextThursday = new Date(today);
  const daysUntilThu = (4 - today.getDay() + 7) % 7 || 7;
  nextThursday.setDate(today.getDate() + daysUntilThu);
  const thuStr = nextThursday.toISOString().slice(0, 8) + nextThursday.getDate();

  const cycleItems = items.filter(i =>
    i.scheduled_date && i.scheduled_date >= cycleStartStr && i.scheduled_date <= cycleEndStr
  );
  const counts = {
    total: cycleItems.length,
    scripted: cycleItems.filter(i => ["scripted", "approved", "recorded", "filmed", "edited", "scheduled", "posted"].includes(i.status)).length,
    recorded: cycleItems.filter(i => ["recorded", "filmed", "edited", "scheduled", "posted"].includes(i.status)).length,
    posted: cycleItems.filter(i => i.status === "posted").length,
  };

  const chips: { label: string; val: number | string; ok: boolean }[] = [
    { label: "scripted", val: `${counts.scripted}/${counts.total}`, ok: counts.scripted >= counts.total && counts.total > 0 },
    { label: "recorded", val: counts.recorded, ok: counts.recorded >= counts.total && counts.total > 0 },
    { label: "posted", val: counts.posted, ok: counts.posted >= counts.total && counts.total > 0 },
    { label: "Recording day", val: `Thu ${nextThursday.toLocaleDateString("en", { month: "short", day: "numeric" })}`, ok: true },
  ];

  return (
    <div className="card-surface flex flex-wrap items-center gap-2 px-3 py-2.5">
      <span className="text-[12px] text-muted-foreground shrink-0 font-medium">This cycle</span>
      {counts.total === 0 ? (
        <span className="text-[13px] text-muted-foreground">No content scheduled for this 2-week window ({cycleStartStr} – {cycleEndStr}).</span>
      ) : (
        chips.map(c => (
          <span key={c.label} className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] ${
            c.ok ? "bg-success-bg text-success-fg" : "bg-muted text-muted-foreground"
          }`}>
            <span className="font-medium">{c.val}</span> {c.label}
          </span>
        ))
      )}
    </div>
  );
}

function ViewTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof CalendarIcon; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium border-b-2 -mb-px motion-safe:transition-colors " +
        (active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

// -- Calendar view --
function CalendarView({ items, monthCursor, setMonthCursor, onOpen }: {
  items: ContentItem[]; monthCursor: Date; setMonthCursor: (d: Date) => void; onOpen: (i: ContentItem) => void;
}) {
  const start = startOfMonth(monthCursor);
  const end   = endOfMonth(monthCursor);
  const days  = eachDayOfInterval({ start, end });
  const leading = (start.getDay() + 6) % 7; // Mon-start
  const grid: (Date | null)[] = [...Array(leading).fill(null), ...days];

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthCursor(subMonths(monthCursor, 1))} className="h-7 px-2 rounded-lg border border-[var(--border)] text-[13px] hover:bg-muted motion-safe:transition-colors">←</button>
          <div className="text-[15px] font-semibold">{format(monthCursor, "MMMM yyyy")}</div>
          <button onClick={() => setMonthCursor(addMonths(monthCursor, 1))} className="h-7 px-2 rounded-lg border border-[var(--border)] text-[13px] hover:bg-muted motion-safe:transition-colors">→</button>
        </div>
        <button onClick={() => setMonthCursor(new Date())} className="h-7 px-2 rounded-lg border border-[var(--border)] text-[13px] hover:bg-muted motion-safe:transition-colors">Today</button>
      </div>
      <div className="grid grid-cols-7 border-b border-[var(--border)] text-[11px] text-muted-foreground">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <div key={d} className="p-2 border-r border-[var(--border)] last:border-r-0">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((day, idx) => {
          const dayItems = day ? items.filter(i => i.scheduled_date && isSameDay(parseISO(i.scheduled_date), day)) : [];
          const isToday = day && isSameDay(day, new Date());
          return (
            <div key={idx} className={`min-h-[96px] p-1.5 border-r border-b border-[var(--border)] last:border-r-0 ${isToday ? "bg-primary/5" : ""}`}>
              {day && (
                <>
                  <div className={`text-[11px] ${isToday ? "text-primary font-semibold" : "text-muted-foreground"} mb-1`}>{format(day, "d")}</div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map(i => (
                      <button
                        key={i.id}
                        onClick={() => onOpen(i)}
                        className={`w-full text-left text-[10px] px-1.5 py-1 rounded-sm border truncate ${PLATFORM_META[i.platform].color}`}
                        title={i.hook}
                      >
                        {PLATFORM_META[i.platform].label}: {i.hook}
                      </button>
                    ))}
                    {dayItems.length > 3 && <div className="text-[9px] text-muted-foreground px-1">+{dayItems.length - 3} more</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -- Kanban view --
function KanbanView({ items, onOpen, onUpdate }: { items: ContentItem[]; onOpen: (i: ContentItem) => void; onUpdate: () => void }) {
  const setStatus = async (id: string, status: Status) => {
    const patch: Partial<ContentItem> = { status };
    if (status === "posted") (patch as { posted_at?: string }).posted_at = new Date().toISOString();
    const { error } = await supabase.from("content_items").update(patch).eq("id", id);
    if (error) toast.error(error.message); else onUpdate();
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
      {STATUSES.filter(s => s.value !== "filmed").map(s => {
        const col = items.filter(i => i.status === s.value || (s.value === "recorded" && i.status === "filmed"));
        return (
          <div key={s.value} className="border border-[var(--border)] bg-[var(--card)] rounded-sm flex flex-col min-h-[400px]">
            <div className={`p-2 border-b border-[var(--border)] flex items-center justify-between ${s.color}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wider">{s.label}</span>
              <span className="text-[10px]">{col.length}</span>
            </div>
            <div className="p-1.5 flex-1 space-y-1.5 overflow-auto">
              {col.map(i => (
                <div key={i.id} className="border border-[var(--border)] bg-[var(--background)] rounded-sm p-2 hover:border-border group">
                  <button onClick={() => onOpen(i)} className="w-full text-left space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-sm border ${PLATFORM_META[i.platform].color}`}>{PLATFORM_META[i.platform].label}</span>
                      {i.scheduled_date && <span className="text-[9px] text-muted-foreground">{format(parseISO(i.scheduled_date), "MMM d")}</span>}
                    </div>
                    <div className="text-xs font-medium line-clamp-3">{i.hook}</div>
                  </button>
                  <div className="mt-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    {STATUSES.filter(t => t.value !== "filmed").map(target => target.value !== i.status && (
                      <button
                        key={target.value}
                        onClick={() => setStatus(i.id, target.value)}
                        className="text-[9px] px-1 py-0.5 rounded-sm border border-[var(--border)] hover:border-border text-muted-foreground hover:text-foreground"
                        title={`Move to ${target.label}`}
                      >
                        {target.label[0]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {col.length === 0 && <div className="text-[10px] text-muted-foreground text-center py-4">Empty</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -- List view --
function ListView({ items, onOpen }: { items: ContentItem[]; onOpen: (i: ContentItem) => void }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-[var(--background)] border-b border-[var(--border)] text-muted-foreground uppercase tracking-wider text-[10px]">
          <tr>
            <th className="text-left p-2 font-medium">Date</th>
            <th className="text-left p-2 font-medium">Platform</th>
            <th className="text-left p-2 font-medium">Hook</th>
            <th className="text-left p-2 font-medium">Format</th>
            <th className="text-left p-2 font-medium">Status</th>
            <th className="text-left p-2 font-medium">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--accent)]">
          {items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No content items yet.</td></tr>}
          {items.map(i => (
            <tr key={i.id} className="hover:bg-[var(--muted)] cursor-pointer" onClick={() => onOpen(i)}>
              <td className="p-2">{i.scheduled_date ?? "—"}</td>
              <td className="p-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${PLATFORM_META[i.platform].color}`}>{PLATFORM_META[i.platform].label}</span></td>
              <td className="p-2 max-w-md truncate">{i.hook}</td>
              <td className="p-2 text-muted-foreground">{i.format ?? "—"}</td>
              <td className="p-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${STATUS_META[i.status].color}`}>{STATUS_META[i.status].label}</span></td>
              <td className="p-2">{i.link_when_posted ? <a href={i.link_when_posted} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-muted-foreground"><ExternalLink className="h-3 w-3 inline" /></a> : <span className="text-muted-foreground">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -- Idea inbox --
function IdeaInbox({ ideas, userId, onChange, onPromote }: {
  ideas: Idea[]; userId: string | null; onChange: () => void;
  onPromote: (i: Idea) => void;
}) {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [triggerType, setTriggerType] = useState<string>("");
  const [explanation, setExplanation] = useState("");
  const [funnelGuess, setFunnelGuess] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [showReset, setShowReset] = useState(false);

  const add = async () => {
    if (!userId || !text.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("content_ideas").insert({
      created_by: userId,
      text: text.trim(),
      link: link.trim() || null,
      trigger_type: triggerType || null,
      explanation: explanation.trim() || null,
      funnel_guess: funnelGuess || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setText(""); setLink(""); setExplanation(""); setTriggerType(""); setFunnelGuess("");
    onChange();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("content_ideas").delete().eq("id", id);
    if (error) toast.error(error.message); else onChange();
  };

  const monthlyReset = async () => {
    const unpromoted = ideas.filter(i => !i.promoted_item_id && !i.harvested);
    if (unpromoted.length === 0) { toast.info("Nothing to archive"); setShowReset(false); return; }
    const { error } = await supabase.from("content_ideas").update({ harvested: true }).in("id", unpromoted.map(i => i.id));
    if (error) return toast.error(error.message);
    toast.success(`Archived ${unpromoted.length} idea${unpromoted.length === 1 ? "" : "s"}`);
    setShowReset(false); onChange();
  };

  const visible = ideas.filter(i => {
    if (i.harvested) return filter === "archived";
    if (filter === "all") return true;
    if (filter === "archived") return false;
    return i.trigger_type === filter;
  });
  const activeCount = ideas.filter(i => !i.harvested).length;

  return (
    <div className="border border-[var(--border)] bg-[var(--card)] rounded-sm">
      <div className="p-3 border-b border-[var(--border)] flex items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 text-warning-fg" />
        <div className="text-sm font-semibold">Idea inbox</div>
        <span className="ml-auto text-[10px] text-muted-foreground">{activeCount} active</span>
        <button onClick={() => setShowReset(true)} className="text-[10px] text-muted-foreground hover:text-muted-foreground underline decoration-dotted">Monthly reset</button>
      </div>
      <div className="p-3 space-y-2 border-b border-[var(--border)]">
        <div className="flex flex-wrap gap-1">
          {TRIGGERS.map(t => (
            <button
              key={t.value}
              onClick={() => setTriggerType(triggerType === t.value ? "" : t.value)}
              title={t.hint}
              className={`h-6 px-2 rounded-sm text-[10px] border ${triggerType === t.value ? "bg-muted border-border text-muted-foreground" : "border-[var(--border)] text-muted-foreground hover:border-border"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="What triggered this? Raw idea, hook, angle…"
          rows={2}
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-border"
        />
        <textarea
          value={explanation} onChange={e => setExplanation(e.target.value)}
          placeholder="How I'd explain it to a friend (voice memo in text)…"
          rows={2}
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-border"
        />
        <div className="flex gap-2">
          <SelectField value={funnelGuess} onChange={(v) => setFunnelGuess(v)} options={[{ value: "tof", label: "TOF" }, { value: "mof", label: "MOF" }]} allowEmpty emptyLabel="Funnel?" placeholder="Funnel?" />
          <input
            value={link} onChange={e => setLink(e.target.value)} placeholder="Optional link"
            className="flex-1 h-7 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-border"
          />
          <button onClick={add} disabled={saving || !text.trim()} className="h-7 px-3 rounded-sm bg-muted hover:bg-muted text-muted-foreground text-xs font-medium disabled:opacity-40">
            <Plus className="h-3 w-3 inline" /> Add
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="p-2 border-b border-[var(--border)] flex flex-wrap gap-1">
        <button onClick={() => setFilter("all")} className={`h-6 px-2 rounded-sm text-[10px] border ${filter === "all" ? "bg-muted border-border text-muted-foreground" : "border-[var(--border)] text-muted-foreground"}`}>All</button>
        {TRIGGERS.map(t => (
          <button key={t.value} onClick={() => setFilter(t.value)} className={`h-6 px-2 rounded-sm text-[10px] border ${filter === t.value ? "bg-muted border-border text-muted-foreground" : "border-[var(--border)] text-muted-foreground"}`}>{t.label}</button>
        ))}
        <button onClick={() => setFilter("archived")} className={`h-6 px-2 rounded-sm text-[10px] border ${filter === "archived" ? "bg-neutral-500/15 border-neutral-500/50 text-neutral-200" : "border-[var(--border)] text-muted-foreground"}`}>Archived</button>
      </div>

      <div className="max-h-[560px] overflow-auto divide-y divide-[var(--accent)]">
        {visible.length === 0 && <div className="text-xs text-muted-foreground text-center p-6">Empty.</div>}
        {visible.map(i => {
          const trig = TRIGGERS.find(t => t.value === i.trigger_type);
          return (
            <div key={i.id} className={`p-2.5 group ${i.promoted_item_id || i.harvested ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                {trig && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-border text-muted-foreground">{trig.label}</span>}
                {i.funnel_guess && <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${i.funnel_guess === "tof" ? "border-border text-muted-foreground" : "border-success/25 text-success-fg"}`}>{i.funnel_guess}</span>}
                {i.harvested && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-neutral-500/30 text-neutral-400">Archived</span>}
              </div>
              <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{i.text}</p>
              {i.explanation && (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground italic whitespace-pre-wrap break-words">{i.explanation}</p>
              )}
              {i.link && (
                <a href={i.link} target="_blank" rel="noreferrer" className="mt-1 text-[10px] text-muted-foreground hover:text-muted-foreground inline-flex items-center gap-1 truncate max-w-full">
                  <ExternalLink className="h-2.5 w-2.5" /> {i.link}
                </a>
              )}
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                {i.promoted_item_id ? (
                  <span className="text-muted-foreground">→ promoted</span>
                ) : i.harvested ? (
                  <span className="text-neutral-500">archived</span>
                ) : (
                  <button onClick={() => onPromote(i)} className="text-muted-foreground hover:text-muted-foreground inline-flex items-center gap-0.5">
                    Harvest → content <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                )}
                <span className="ml-auto">{format(parseISO(i.created_at), "MMM d")}</span>
                <button onClick={() => del(i.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger-fg">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showReset && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={() => setShowReset(false)}>
          <div className="w-full max-w-md bg-[var(--card)] border border-border rounded-sm" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border)]">
              <div className="text-sm font-semibold">Monthly reset</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Archive all un-harvested ideas so next month starts clean.
                Nothing is deleted — you can filter by "Archived" to review later.
              </div>
            </div>
            <div className="p-4 text-xs">
              <div className="border border-[var(--border)] bg-[var(--background)] rounded-sm p-2.5">
                <span className="text-2xl font-semibold text-muted-foreground">{ideas.filter(i => !i.promoted_item_id && !i.harvested).length}</span>
                <span className="text-muted-foreground text-[11px]"> ideas will be archived</span>
              </div>
            </div>
            <div className="p-3 border-t border-[var(--border)] flex justify-end gap-2">
              <button onClick={() => setShowReset(false)} className="h-8 px-3 rounded-sm border border-[var(--border)] text-xs">Cancel</button>
              <button onClick={monthlyReset} className="h-8 px-3 rounded-sm bg-muted hover:bg-muted text-muted-foreground text-xs font-medium">Archive</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -- Create/edit dialog --
function ItemDialog({ initial, userId, onClose, onSaved, promotingIdea: pIdea }: {
  initial: ContentItem | null;
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
  promotingIdea: Idea | null;
}) {
  const isNew = !initial?.id;
  const [scheduled, setScheduled] = useState(initial?.scheduled_date ?? "");
  const [platform, setPlatform] = useState<Platform>(initial?.platform ?? "instagram");
  const [format, setFormat] = useState(initial?.format ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [hook, setHook] = useState(initial?.hook ?? pIdea?.text ?? "");
  const [script, setScript] = useState(initial?.script ?? (pIdea?.link ? `Source: ${pIdea.link}` : ""));
  const [status, setStatus] = useState<Status>(initial?.status ?? "idea");
  const [link, setLink] = useState(initial?.link_when_posted ?? "");
  const [tagsStr, setTagsStr] = useState(initial?.tags.join(", ") ?? "");
  const [rawVideo, setRawVideo] = useState(initial?.raw_video_url ?? "");
  const [editedReel, setEditedReel] = useState(initial?.edited_reel_url ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [duration, setDuration] = useState<string>(initial?.duration_sec ? String(initial.duration_sec) : "");
  const [platformsMulti, setPlatformsMulti] = useState<string[]>(initial?.platforms ?? ["instagram"]);
  const [reedit, setReedit] = useState<boolean>(initial?.reedit_flag ?? false);
  const [busy, setBusy] = useState(false);

  const togglePlatform = (v: string) =>
    setPlatformsMulti(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const save = async () => {
    if (!userId || !hook.trim()) { toast.error("Hook required"); return; }
    setBusy(true);
    const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
    const durNum = duration.trim() ? parseInt(duration, 10) : null;
    const payload = {
      created_by: userId,
      scheduled_date: scheduled || null,
      platform, format: format || null, hook: hook.trim(),
      title: title.trim() || null,
      script: script || null, status,
      link_when_posted: link || null, tags,
      raw_video_url: rawVideo.trim() || null,
      edited_reel_url: editedReel.trim() || null,
      source: source.trim() || null,
      duration_sec: durNum && !Number.isNaN(durNum) ? durNum : null,
      platforms: platformsMulti.length ? platformsMulti : ["instagram"],
      reedit_flag: reedit,
      posted_at: status === "posted" ? (initial?.posted_at ?? new Date().toISOString()) : (initial?.posted_at ?? null),
      recorded_at: (status === "recorded" || status === "filmed") ? (initial?.recorded_at ?? new Date().toISOString()) : initial?.recorded_at ?? null,
      edited_at: status === "edited" ? (initial?.edited_at ?? new Date().toISOString()) : initial?.edited_at ?? null,
    };
    if (isNew) {
      const { data, error } = await supabase.from("content_items").insert(payload).select().single();
      if (error) { setBusy(false); return toast.error(error.message); }
      if (pIdea) {
        await supabase.from("content_ideas").update({ promoted_item_id: (data as ContentItem).id }).eq("id", pIdea.id);
      }
    } else {
      const { error } = await supabase.from("content_items").update(payload).eq("id", initial!.id);
      if (error) { setBusy(false); return toast.error(error.message); }
    }
    setBusy(false);
    toast.success(isNew ? "Content added" : "Saved");
    onSaved(); onClose();
  };

  const del = async () => {
    if (!initial?.id) return;
    if (!confirm("Delete this content item?")) return;
    const { error } = await supabase.from("content_items").delete().eq("id", initial.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-auto" onClick={onClose}>
      <div className="w-full max-w-3xl my-8 bg-[var(--card)] border border-[var(--border)] rounded-sm" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{isNew ? "New content" : "Edit content"}</div>
            {pIdea && <div className="text-[10px] text-muted-foreground">Promoting from idea inbox</div>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Title (short label — for the record)">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., How I hire closers" className="w-full h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm outline-none focus:border-border" />
          </Field>
          <Field label="Hook / opening line *">
            <textarea value={hook} onChange={e => setHook(e.target.value)} rows={2} className="w-full bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-sm resize-none focus:outline-none focus:border-border" placeholder="First 3 seconds. Pattern break, promise, identity claim…" />
          </Field>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Field label="Status">
              <SelectField value={status} onChange={v => setStatus(v as Status)} options={STATUSES.filter(s => s.value !== "filmed").map(s => ({ value: s.value, label: s.label }))} />
            </Field>
            <Field label="Scheduled date">
              <DateField value={scheduled} onChange={setScheduled} placeholder="Not scheduled" />
            </Field>
            <Field label="Format / creative type">
              <SelectField value={format} onChange={(v) => setFormat(v)} options={CREATIVE_TYPES.map((c) => ({ value: c, label: c }))} allowEmpty emptyLabel="—" placeholder="—" />
            </Field>
            <Field label="Duration (sec)">
              <input type="number" min={0} value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g., 45" className="w-full h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-border" />
            </Field>
          </div>

          <Field label="Platforms (where this will post)">
            <div className="flex flex-wrap gap-1.5">
              {MULTI_PLATFORMS.map(p => {
                const on = platformsMulti.includes(p.value);
                return (
                  <button
                    type="button"
                    key={p.value}
                    onClick={() => togglePlatform(p.value)}
                    className={`h-7 px-2.5 rounded-sm text-[11px] border transition ${on ? "bg-muted border-border text-muted-foreground" : "bg-[var(--background)] border-[var(--border)] text-muted-foreground hover:border-border"}`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Script (markdown supported)">
            <textarea value={script} onChange={e => setScript(e.target.value)} rows={10} className="w-full bg-[var(--background)] border border-[var(--border)] rounded-sm p-2 text-sm resize-y focus:outline-none focus:border-border" placeholder={"Write the reel here.\n\n- Hook line\n- Body / points\n- CTA / close"} />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Raw video URL">
              <input value={rawVideo} onChange={e => setRawVideo(e.target.value)} placeholder="Drive / Frame.io link" className="w-full h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-border" />
            </Field>
            <Field label="Edited reel URL">
              <input value={editedReel} onChange={e => setEditedReel(e.target.value)} placeholder="Editor delivery link" className="w-full h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-border" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Source (where the idea came from)">
              <input value={source} onChange={e => setSource(e.target.value)} placeholder="e.g., client call, Notion note, viral reel" className="w-full h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-border" />
            </Field>
            <Field label="Primary platform (for icon color)">
              <SelectField value={platform} onChange={(v) => setPlatform(v as Platform)} options={PLATFORMS.map((p) => ({ value: p.value, label: p.label }))} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Link when posted">
              <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" className="w-full h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-border" />
            </Field>
            <Field label="Tags (comma separated)">
              <input value={tagsStr} onChange={e => setTagsStr(e.target.value)} className="w-full h-8 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-xs outline-none focus:border-border" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={reedit} onChange={e => setReedit(e.target.checked)} className="accent-blue-500" />
            Needs re-edit (send back to editor)
          </label>
        </div>
        <div className="p-4 border-t border-[var(--border)] flex items-center justify-between">
          <div>
            {!isNew && (
              <button onClick={del} className="h-8 px-3 rounded-sm border border-danger/25 text-danger-fg hover:bg-danger-bg text-xs">
                <Trash2 className="h-3 w-3 inline mr-1" /> Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-8 px-3 rounded-sm border border-[var(--border)] text-xs">Cancel</button>
            <button onClick={save} disabled={busy || !hook.trim()} className="h-8 px-3 rounded-sm bg-muted hover:bg-muted text-muted-foreground text-xs font-medium disabled:opacity-40">
              {busy ? "Saving…" : (isNew ? "Create" : "Save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
