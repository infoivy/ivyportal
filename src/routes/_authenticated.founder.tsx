import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Sparkles, Calendar as CalendarIcon, Columns3, List as ListIcon, Lightbulb,
  Plus, ExternalLink, Trash2, X, ArrowRight, BookOpen, Loader2,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from "date-fns";

export const Route = createFileRoute("/_authenticated/founder")({
  head: () => ({ meta: [{ title: "Founder Space — ISA Portal" }] }),
  component: FounderPage,
});

type Platform = "instagram" | "tiktok" | "youtube" | "twitter" | "linkedin" | "threads" | "other";
type Status = "idea" | "scripted" | "filmed" | "edited" | "posted";

type ContentItem = {
  id: string;
  created_by: string;
  scheduled_date: string | null;
  platform: Platform;
  format: string | null;
  hook: string;
  script: string | null;
  status: Status;
  link_when_posted: string | null;
  tags: string[];
  posted_at: string | null;
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
};

const PLATFORMS: { value: Platform; label: string; color: string }[] = [
  { value: "instagram", label: "IG",       color: "bg-pink-500/10 text-pink-300 border-pink-500/30" },
  { value: "tiktok",    label: "TikTok",   color: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30" },
  { value: "youtube",   label: "YT",       color: "bg-red-500/10 text-red-300 border-red-500/30" },
  { value: "twitter",   label: "X",        color: "bg-slate-500/10 text-slate-300 border-slate-500/30" },
  { value: "linkedin",  label: "LinkedIn", color: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
  { value: "threads",   label: "Threads",  color: "bg-purple-500/10 text-purple-300 border-purple-500/30" },
  { value: "other",     label: "Other",    color: "bg-neutral-500/10 text-neutral-300 border-neutral-500/30" },
];
const PLATFORM_META = Object.fromEntries(PLATFORMS.map(p => [p.value, p])) as Record<Platform, typeof PLATFORMS[number]>;

const STATUSES: { value: Status; label: string; color: string }[] = [
  { value: "idea",     label: "Idea",     color: "bg-neutral-500/10 text-neutral-300 border-neutral-500/30" },
  { value: "scripted", label: "Scripted", color: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  { value: "filmed",   label: "Filmed",   color: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
  { value: "edited",   label: "Edited",   color: "bg-purple-500/10 text-purple-300 border-purple-500/30" },
  { value: "posted",   label: "Posted",   color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
];
const STATUS_META = Object.fromEntries(STATUSES.map(s => [s.value, s])) as Record<Status, typeof STATUSES[number]>;

function FounderPage() {
  const { user, roles } = useAuth();
  const isFounder = roles.includes("founder");

  const [items, setItems] = useState<ContentItem[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [view, setView] = useState<"calendar" | "kanban" | "list">("kanban");
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

  useEffect(() => { if (isFounder) load(); }, [isFounder]);

  if (!isFounder) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-2">
        <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
        <div className="text-lg font-semibold">Founder Space</div>
        <p className="text-sm text-muted-foreground">This area is not accessible with your account.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1f2530] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-fuchsia-400 mb-1">
            <Sparkles className="h-3 w-3" /> Founder space
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Content & Strategy</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Content calendar, idea inbox, and strategy SOPs — private to you.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/knowledge"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-[#1f2530] hover:border-fuchsia-500/40 text-xs"
          >
            <BookOpen className="h-3.5 w-3.5" /> Content SOPs
          </Link>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-fuchsia-500 hover:bg-fuchsia-400 text-fuchsia-950 text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5" /> New content
          </button>
        </div>
      </header>

      {/* View switcher */}
      <div className="flex items-center gap-1 border-b border-[#1f2530]">
        <ViewTab active={view === "calendar"} onClick={() => setView("calendar")} icon={CalendarIcon} label="Calendar" />
        <ViewTab active={view === "kanban"}   onClick={() => setView("kanban")}   icon={Columns3}     label="Kanban" />
        <ViewTab active={view === "list"}     onClick={() => setView("list")}     icon={ListIcon}     label="List" />
      </div>

      {loading ? (
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

  // Local state hoisted to top-level via closure emulation not ideal; handled inline below.
}

// -- View tabs --
function ViewTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof CalendarIcon; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-1.5 h-9 px-3 text-xs font-medium border-b-2 -mb-px transition " +
        (active ? "border-fuchsia-400 text-fuchsia-300" : "border-transparent text-muted-foreground hover:text-foreground")
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
    <div className="border border-[#1f2530] rounded-sm bg-[#0f1116]">
      <div className="flex items-center justify-between p-3 border-b border-[#1f2530]">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthCursor(subMonths(monthCursor, 1))} className="h-7 px-2 rounded-sm border border-[#1f2530] text-xs hover:border-fuchsia-500/40">←</button>
          <div className="text-sm font-semibold">{format(monthCursor, "MMMM yyyy")}</div>
          <button onClick={() => setMonthCursor(addMonths(monthCursor, 1))} className="h-7 px-2 rounded-sm border border-[#1f2530] text-xs hover:border-fuchsia-500/40">→</button>
        </div>
        <button onClick={() => setMonthCursor(new Date())} className="h-7 px-2 rounded-sm border border-[#1f2530] text-xs hover:border-fuchsia-500/40">Today</button>
      </div>
      <div className="grid grid-cols-7 border-b border-[#1f2530] text-[10px] uppercase tracking-wider text-muted-foreground">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <div key={d} className="p-2 border-r border-[#1f2530] last:border-r-0">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((day, idx) => {
          const dayItems = day ? items.filter(i => i.scheduled_date && isSameDay(parseISO(i.scheduled_date), day)) : [];
          const isToday = day && isSameDay(day, new Date());
          return (
            <div key={idx} className={`min-h-[96px] p-1.5 border-r border-b border-[#1f2530] last:border-r-0 ${isToday ? "bg-fuchsia-500/5" : ""}`}>
              {day && (
                <>
                  <div className={`text-[10px] font-mono ${isToday ? "text-fuchsia-300 font-bold" : "text-muted-foreground"} mb-1`}>{format(day, "d")}</div>
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
      {STATUSES.map(s => {
        const col = items.filter(i => i.status === s.value);
        return (
          <div key={s.value} className="border border-[#1f2530] bg-[#0f1116] rounded-sm flex flex-col min-h-[400px]">
            <div className={`p-2 border-b border-[#1f2530] flex items-center justify-between ${s.color}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wider">{s.label}</span>
              <span className="text-[10px] font-mono">{col.length}</span>
            </div>
            <div className="p-1.5 flex-1 space-y-1.5 overflow-auto">
              {col.map(i => (
                <div key={i.id} className="border border-[#1f2530] bg-[#0a0b0f] rounded-sm p-2 hover:border-fuchsia-500/40 group">
                  <button onClick={() => onOpen(i)} className="w-full text-left space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-sm border ${PLATFORM_META[i.platform].color}`}>{PLATFORM_META[i.platform].label}</span>
                      {i.scheduled_date && <span className="text-[9px] text-muted-foreground font-mono">{format(parseISO(i.scheduled_date), "MMM d")}</span>}
                    </div>
                    <div className="text-xs font-medium line-clamp-3">{i.hook}</div>
                  </button>
                  <div className="mt-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    {STATUSES.map(target => target.value !== i.status && (
                      <button
                        key={target.value}
                        onClick={() => setStatus(i.id, target.value)}
                        className="text-[9px] px-1 py-0.5 rounded-sm border border-[#1f2530] hover:border-fuchsia-500/40 text-muted-foreground hover:text-foreground"
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
    <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-[#0a0b0f] border-b border-[#1f2530] text-muted-foreground uppercase tracking-wider text-[10px]">
          <tr>
            <th className="text-left p-2 font-medium">Date</th>
            <th className="text-left p-2 font-medium">Platform</th>
            <th className="text-left p-2 font-medium">Hook</th>
            <th className="text-left p-2 font-medium">Format</th>
            <th className="text-left p-2 font-medium">Status</th>
            <th className="text-left p-2 font-medium">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1a1f29]">
          {items.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No content items yet.</td></tr>}
          {items.map(i => (
            <tr key={i.id} className="hover:bg-[#14171e] cursor-pointer" onClick={() => onOpen(i)}>
              <td className="p-2 font-mono">{i.scheduled_date ?? "—"}</td>
              <td className="p-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${PLATFORM_META[i.platform].color}`}>{PLATFORM_META[i.platform].label}</span></td>
              <td className="p-2 max-w-md truncate">{i.hook}</td>
              <td className="p-2 text-muted-foreground">{i.format ?? "—"}</td>
              <td className="p-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${STATUS_META[i.status].color}`}>{STATUS_META[i.status].label}</span></td>
              <td className="p-2">{i.link_when_posted ? <a href={i.link_when_posted} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-fuchsia-400 hover:text-fuchsia-300"><ExternalLink className="h-3 w-3 inline" /></a> : <span className="text-muted-foreground">—</span>}</td>
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
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!userId || !text.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("content_ideas").insert({ created_by: userId, text: text.trim(), link: link.trim() || null });
    setSaving(false);
    if (error) return toast.error(error.message);
    setText(""); setLink(""); onChange();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("content_ideas").delete().eq("id", id);
    if (error) toast.error(error.message); else onChange();
  };

  const promote = (idea: Idea) => { onPromote(idea); };


  return (
    <div className="border border-[#1f2530] bg-[#0f1116] rounded-sm">
      <div className="p-3 border-b border-[#1f2530] flex items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
        <div className="text-sm font-semibold">Idea inbox</div>
        <span className="ml-auto text-[10px] text-muted-foreground">{ideas.length}</span>
      </div>
      <div className="p-3 space-y-2 border-b border-[#1f2530]">
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Capture an idea… hook, angle, insight."
          rows={2}
          className="w-full bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 text-xs resize-none focus:outline-none focus:border-fuchsia-500/40"
        />
        <div className="flex gap-2">
          <input
            value={link} onChange={e => setLink(e.target.value)} placeholder="Optional link"
            className="flex-1 h-7 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs outline-none focus:border-fuchsia-500/40"
          />
          <button onClick={add} disabled={saving || !text.trim()} className="h-7 px-3 rounded-sm bg-fuchsia-500 hover:bg-fuchsia-400 text-fuchsia-950 text-xs font-medium disabled:opacity-40">
            <Plus className="h-3 w-3 inline" /> Add
          </button>
        </div>
      </div>
      <div className="max-h-[560px] overflow-auto divide-y divide-[#1a1f29]">
        {ideas.length === 0 && <div className="text-xs text-muted-foreground text-center p-6">Empty — capture your first idea.</div>}
        {ideas.map(i => (
          <div key={i.id} className={`p-2.5 group ${i.promoted_item_id ? "opacity-60" : ""}`}>
            <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{i.text}</p>
            {i.link && (
              <a href={i.link} target="_blank" rel="noreferrer" className="mt-1 text-[10px] text-fuchsia-400 hover:text-fuchsia-300 inline-flex items-center gap-1 truncate max-w-full">
                <ExternalLink className="h-2.5 w-2.5" /> {i.link}
              </a>
            )}
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
              {i.promoted_item_id ? (
                <span className="text-fuchsia-400">→ promoted</span>
              ) : (
                <button onClick={() => promote(i)} className="text-fuchsia-400 hover:text-fuchsia-300 inline-flex items-center gap-0.5">
                  Promote <ArrowRight className="h-2.5 w-2.5" />
                </button>
              )}
              <span className="ml-auto">{format(parseISO(i.created_at), "MMM d")}</span>
              <button onClick={() => del(i.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-400">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
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
  const pIdea = promotingIdea;
  const [scheduled, setScheduled] = useState(initial?.scheduled_date ?? "");
  const [platform, setPlatform] = useState<Platform>(initial?.platform ?? "instagram");
  const [format, setFormat] = useState(initial?.format ?? "");
  const [hook, setHook] = useState(initial?.hook ?? pIdea?.text ?? "");
  const [script, setScript] = useState(initial?.script ?? (pIdea?.link ? `Source: ${pIdea.link}` : ""));
  const [status, setStatus] = useState<Status>(initial?.status ?? "idea");
  const [link, setLink] = useState(initial?.link_when_posted ?? "");
  const [tagsStr, setTagsStr] = useState(initial?.tags.join(", ") ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!userId || !hook.trim()) { toast.error("Hook required"); return; }
    setBusy(true);
    const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
    const payload = {
      created_by: userId,
      scheduled_date: scheduled || null,
      platform, format: format || null, hook: hook.trim(),
      script: script || null, status,
      link_when_posted: link || null, tags,
      posted_at: status === "posted" ? (initial?.posted_at ?? new Date().toISOString()) : null,
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
      <div className="w-full max-w-2xl my-8 bg-[#0f1116] border border-[#1f2530] rounded-sm" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-[#1f2530] flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{isNew ? "New content" : "Edit content"}</div>
            {pIdea && <div className="text-[10px] text-fuchsia-400">Promoting from idea inbox</div>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Scheduled date">
              <input type="date" value={scheduled} onChange={e => setScheduled(e.target.value)} className="w-full h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs outline-none focus:border-fuchsia-500/40" />
            </Field>
            <Field label="Platform">
              <select value={platform} onChange={e => setPlatform(e.target.value as Platform)} className="w-full h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs outline-none focus:border-fuchsia-500/40">
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value as Status)} className="w-full h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs outline-none focus:border-fuchsia-500/40">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Format (e.g., talking-head, listicle, story…)">
            <input value={format} onChange={e => setFormat(e.target.value)} className="w-full h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs outline-none focus:border-fuchsia-500/40" />
          </Field>
          <Field label="Hook / idea *">
            <textarea value={hook} onChange={e => setHook(e.target.value)} rows={2} className="w-full bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 text-sm resize-none focus:outline-none focus:border-fuchsia-500/40" />
          </Field>
          <Field label="Script (markdown supported)">
            <textarea value={script} onChange={e => setScript(e.target.value)} rows={8} className="w-full bg-[#0a0b0f] border border-[#1f2530] rounded-sm p-2 text-sm font-mono resize-none focus:outline-none focus:border-fuchsia-500/40" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Link when posted">
              <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" className="w-full h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs outline-none focus:border-fuchsia-500/40" />
            </Field>
            <Field label="Tags (comma separated)">
              <input value={tagsStr} onChange={e => setTagsStr(e.target.value)} className="w-full h-8 px-2 rounded-sm border border-[#1f2530] bg-[#0a0b0f] text-xs outline-none focus:border-fuchsia-500/40" />
            </Field>
          </div>
        </div>
        <div className="p-4 border-t border-[#1f2530] flex items-center justify-between">
          <div>
            {!isNew && (
              <button onClick={del} className="h-8 px-3 rounded-sm border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs">
                <Trash2 className="h-3 w-3 inline mr-1" /> Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-8 px-3 rounded-sm border border-[#1f2530] text-xs">Cancel</button>
            <button onClick={save} disabled={busy || !hook.trim()} className="h-8 px-3 rounded-sm bg-fuchsia-500 hover:bg-fuchsia-400 text-fuchsia-950 text-xs font-medium disabled:opacity-40">
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
