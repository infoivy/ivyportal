import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play, Clock, CheckCircle2, Lock, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({ meta: [{ title: "Training — ISA Team" }] }),
  component: Training,
});

type Video = {
  id: string; title: string; description: string; category: string;
  duration: string; thumb: string; locked?: boolean; completed?: boolean;
};

const CATEGORIES = ["All", "Onboarding", "DM Frameworks", "Objection Handling", "Booking Calls", "CRM Hygiene"] as const;

const VIDEOS: Video[] = [
  { id: "1", title: "ISA Team Welcome & Setting Process Overview",
    description: "Start here. Full walkthrough of the setting process, from initial outreach through booked call.",
    category: "Onboarding", duration: "18:24", thumb: "#0d6b5b", completed: true },
  { id: "2", title: "The 4-Question DM Opener",
    description: "The exact opening sequence to use in every conversation. Includes real examples.",
    category: "DM Frameworks", duration: "12:08", thumb: "#3b82f6" },
  { id: "3", title: "Handling 'I'm not interested'",
    description: "The single most common objection and 3 ways to reframe it into a real conversation.",
    category: "Objection Handling", duration: "9:15", thumb: "#f59e0b" },
  { id: "4", title: "Booking with Calendar Confidence",
    description: "How to transition from qualified conversation to a booked call in under 5 messages.",
    category: "Booking Calls", duration: "14:32", thumb: "#22c55e" },
  { id: "5", title: "CRM Hygiene: Daily Discipline",
    description: "The 15-minute end-of-day CRM ritual every setter follows.",
    category: "CRM Hygiene", duration: "7:44", thumb: "#a855f7" },
  { id: "6", title: "Handling Price Objections",
    description: "Advanced objection: 'I can't afford it.' What NOT to say.",
    category: "Objection Handling", duration: "11:22", thumb: "#ef4444", locked: true },
  { id: "7", title: "Voice Notes That Convert",
    description: "When and how to use voice notes. Cadence, tone, length.",
    category: "DM Frameworks", duration: "6:50", thumb: "#06b6d4", locked: true },
  { id: "8", title: "Reactivating Cold Leads",
    description: "The 3-message sequence for 90-day-old conversations that went dark.",
    category: "DM Frameworks", duration: "10:12", thumb: "#ec4899", locked: true },
];

function Training() {
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");

  const filtered = VIDEOS.filter(v =>
    (category === "All" || v.category === category) &&
    (query === "" || v.title.toLowerCase().includes(query.toLowerCase()))
  );

  const completed = VIDEOS.filter(v => v.completed).length;
  const total = VIDEOS.filter(v => !v.locked).length;

  return (
    <div className="dashboard-dark min-h-full">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-bold">Training Library</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completed} of {total} videos completed · {Math.round((completed / total) * 100)}% progress
            </p>
          </div>
          <div className="relative shrink-0">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search videos..."
              className="pl-8 pr-3 py-1.5 rounded-sm border border-border bg-card text-xs w-44 sm:w-64 focus:outline-none focus:border-white/30" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-emerald-400">Your Training Progress</span>
            <span className="tabular-nums text-muted-foreground">{completed}/{total}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${(completed / total) * 100}%` }} />
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-sm border transition ${
                category === c ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"
              }`}>
              {c}
            </button>
          ))}
        </div>

        {/* Video grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(v => (
            <div key={v.id} className={`rounded-md border border-border bg-card overflow-hidden group ${v.locked ? "opacity-60" : "hover:border-white/20 cursor-pointer"} transition`}>
              <div className="aspect-video relative flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${v.thumb}, var(--background))` }}>
                <div className={`grid h-12 w-12 place-items-center rounded-full ${v.locked ? "bg-white/10" : "bg-white/90 group-hover:scale-110"} transition`}>
                  {v.locked ? <Lock className="h-4 w-4 text-white" /> : <Play className="h-5 w-5 text-black fill-black ml-0.5" />}
                </div>
                <div className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded-sm bg-black/70 text-white inline-flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {v.duration}
                </div>
                {v.completed && (
                  <div className="absolute top-2 right-2 grid h-5 w-5 place-items-center rounded-full bg-emerald-500">
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{v.category}</div>
                <h3 className="text-sm font-semibold leading-tight mb-1">{v.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{v.description}</p>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-xs text-muted-foreground">No videos match your search.</div>
        )}

        <p className="text-[10px] text-muted-foreground text-center pt-4">
          Videos are placeholders. Admins can upload real training content once the storage bucket is enabled.
        </p>
      </div>
    </div>
  );
}
