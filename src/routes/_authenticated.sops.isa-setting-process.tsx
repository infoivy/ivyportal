import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { TransformWrapper, TransformComponent, useControls, useTransformEffect, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import React, { useRef, useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { type TabId } from "@/data/content";
import { SECTIONS } from "@/data/sections";
import { useIsMobile } from "@/hooks/use-mobile";
import logoAsset from "@/assets/isa-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sops/isa-setting-process")({
  head: () => ({
    meta: [
      { title: "Ivy Sales Academy · Setting Mastery" },
      { name: "description", content: "Complete system: conversation flows, scripts, objection handling, psychology, engagement & operations" },
    ],
  }),
  component: SettingProcessGate,
});

// Staff SOP (admin/setter surface in Knowledge): students never see it.
function SettingProcessGate() {
  const { roles } = useAuth();
  if (roles.length > 0 && roles.every(r => r === "student")) return <Navigate to="/knowledge" replace />;
  return <Index />;
}

const HEADER_HEIGHT_DESKTOP = 118;
const HEADER_HEIGHT_MOBILE = 104;
const CANVAS_PAD_LEFT = 24;
const CANVAS_PAD_TOP = 24;

// Keyword synonyms — typing "expensive" hits money/budget cards, etc.
const SYNONYMS: Record<string, string[]> = {
  money: ["money", "budget", "financial", "price", "afford", "expensive", "cost", "cheap", "invest", "savings", "broke", "poor"],
  time: ["time", "hours", "schedule", "busy", "commitment", "hours available"],
  belief: ["belief", "mindset", "fear", "confidence", "not ready", "ready", "doubt", "imposter", "worth", "deserve"],
  deen: ["deen", "halal", "haram", "religious", "faith", "istikhara", "riba", "islam", "muslim", "shariah"],
  family: ["family", "parents", "wife", "spouse", "mother", "father", "approval"],
  objections: ["objection", "objections", "handle", "reframe"],
  outbound: ["outbound", "cold", "dm", "opener", "prospect"],
  inbound: ["inbound", "path", "warm", "keyword"],
  followup: ["follow up", "follow-up", "followup", "chase", "nurture"],
  hijrah: ["hijrah", "move", "relocate", "migration"],
};

const SUGGESTIONS = ["objections", "budget", "halal", "hijrah", "mindset", "family", "outbound", "follow-up"];

// Constraint filter chips (one-tap during a live convo)
const CONSTRAINT_CHIPS: { label: string; query: string; color: string }[] = [
  { label: "Money", query: "money", color: "var(--tab-outbound)" },
  { label: "Time", query: "time", color: "var(--tab-conv)" },
  { label: "Belief", query: "belief", color: "var(--tab-psych)" },
  { label: "Deen", query: "deen", color: "var(--tab-inbound)" },
];

const SEARCH_TAGS: Record<TabId, string[]> = {
  stages: ["stage", "process", "steps", "flow", "profile", "opener", "problem", "deep dive", "constraint", "routing", "recommendation", "close", "calendly", "exploring", "stuck", "learning", "in the game", "identity", "quick check", "icp"],
  inbound: ["inbound", "path", "keyword", "reply", "permission close", ...SYNONYMS.money, "halal", "haram", "5-minute", "five minute"],
  financial: ["financial qualification", "qualify", "qualification", "income", "savings", "budget", "invest", "money", "green", "amber", "red", "decision authority", "readiness"],
  outbound: ["outbound", "opener", "dm", "cold", "prospect", "targeting", "who to dm", "leads", "bad lead", "green flag", "red flag", "hot", "warm", "response time"],
  story: ["story", "reply", "engagement", "reaction", "posts", "instagram", "gym", "win", "struggle", "quote", "motivation"],
  conv: ["conversation", "conv", "flow", "value drop", "youtube", "trust", "nurture", "warm", "brother", "self-identify", ...SYNONYMS.followup, "case study"],
  dmclose: ["dm close", "close", ...SYNONYMS.objections, ...SYNONYMS.money, ...SYNONYMS.time, ...SYNONYMS.family, ...SYNONYMS.belief, ...SYNONYMS.deen, "burned", "scammed", "trust", "think about", "not ready", "binary"],
  followup: ["follow-up", "follow up", "followup", "bump", "ghosted", "no reply", "calendly", "no show", "no-show", "rebook", "reminder", "show rate", "istikhara", "wife", "parents", "waiting box", "ladder", "fast ladder", "slow ladder", "binary", ...SYNONYMS.followup],
  psych: ["psychology", "principle", ...SYNONYMS.belief, "authority", "empathy", "emotion", "trust", "expect", "need", "destination"],
  engage: ["engagement", "engage", "story", ...SYNONYMS.followup, "friend", "warm", "cold", "testimonial", "sunday", "pipeline", "proof", "student", "case study"],
  pacing: ["pacing", "ops", "operations", "schedule", "tracking", "crm", "targets", "kpi", "metrics", "daily", "sunday", "non-negotiable", "personality", "empathy phrases", "handoff", "closer", "benchmark", "stats", "feedback"],
};

type PageMode = "workflow" | "library";
type WorkflowCardRef = { section: TabId; title: string; label?: string };
type WorkflowStep = {
  id: string;
  short: string;
  title: string;
  instruction: string;
  moveOnWhen: string;
  cards: WorkflowCardRef[];
};

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "identity",
    short: "Role",
    title: "Set your frame",
    instruction: "Read this before the shift. Your job is to diagnose and route, not convince everyone to book.",
    moveOnWhen: "You can enter the inbox without needing a booking.",
    cards: [{ section: "stages", title: "The Setter's Identity" }],
  },
  {
    id: "fit",
    short: "Fit",
    title: "Check the man before replying",
    instruction: "Confirm basic ICP fit, research the profile, then choose the highest-intent conversation. Do not start with the oldest DM.",
    moveOnWhen: "You know who he is, why this DM matters, and whether he is worth opening.",
    cards: [
      { section: "stages", title: "ICP Quick-Check" },
      { section: "stages", title: "Stage 1: Profile Research", label: "Profile Research" },
      { section: "inbound", title: "Backlog Triage: 1,000+ DMs" },
    ],
  },
  {
    id: "open",
    short: "Open",
    title: "Open the inbound conversation",
    instruction: "Match the script to why he messaged. Send one message, then wait. Never paste the entire flow.",
    moveOnWhen: "He replies with enough context to continue naturally.",
    cards: [
      { section: "inbound", title: "Common Inbound Situations" },
      { section: "inbound", title: "The 5-Minute Rule" },
    ],
  },
  {
    id: "diagnose",
    short: "Diagnose",
    title: "Find the real problem",
    instruction: "React to his words, then ask one connected question. Do not qualify money before he has shared a real goal or problem.",
    moveOnWhen: "You can state his current situation, desired outcome, and real obstacle in his own words.",
    cards: [
      { section: "stages", title: "Stage 3: Problem Identification", label: "Identify the Real Problem" },
      { section: "inbound", title: "Problem ID Responses" },
      { section: "stages", title: "Stage 4: Situation Deep-Dive", label: "Situation Deep-Dive" },
    ],
  },
  {
    id: "qualify",
    short: "Qualify",
    title: "Financial Qualification",
    instruction: "Qualify time, financial capacity, decision authority, and readiness one question at a time. This is responsible routing, not pressure.",
    moveOnWhen: "All six qualification boxes are known and the lead is clearly Green, Amber, or Red.",
    cards: [
      { section: "financial", title: "The DM Qualification Lane" },
      { section: "financial", title: "Hard Qualification Without Burning the Lead" },
    ],
  },
  {
    id: "route",
    short: "Route",
    title: "Choose one route and close cleanly",
    instruction: "Book only Green leads. Give Amber leads a dated nurture plan. Route Red leads to free help and stop pushing.",
    moveOnWhen: "The lead has one clear next action and no false expectation.",
    cards: [
      { section: "financial", title: "Green, Amber, Red Routing" },
      { section: "stages", title: "Stage 6: Support Level Routing", label: "Support Level Routing" },
      { section: "inbound", title: "Permission Close" },
    ],
  },
  {
    id: "handoff",
    short: "Handoff",
    title: "Confirm, hand off, and follow up",
    instruction: "Once booked, record what the closer needs immediately. If the calendar was sent but not booked, follow the exact ladder.",
    moveOnWhen: "The booking is confirmed, the closer has context, and the next follow-up is dated.",
    cards: [
      { section: "pacing", title: "The Closer Handoff" },
      { section: "followup", title: "Calendly Sent, Not Booked (fast ladder)" },
      { section: "followup", title: "Booked: Show-Rate Sequence" },
    ],
  },
];

const LIBRARY_GROUPS: { id: string; title: string; description: string; sections: TabId[] }[] = [
  {
    id: "inbound",
    title: "1. Inbound Setting",
    description: "Identity, ICP, inbound conversation stages, routing, and booking.",
    sections: ["stages", "inbound"],
  },
  {
    id: "financial",
    title: "2. Financial Qualification",
    description: "Check capacity, decision authority, and readiness before booking or nurturing.",
    sections: ["financial"],
  },
  {
    id: "outbound",
    title: "3. Outbound Setting",
    description: "Who to contact, how to open, story replies, and the cold-to-booked conversation flow.",
    sections: ["outbound", "story", "conv"],
  },
  {
    id: "closing",
    title: "4. Closing and Follow-Up",
    description: "DM closing, objection handling, follow-up ladders, no-shows, and nurture.",
    sections: ["dmclose", "followup"],
  },
  {
    id: "operations",
    title: "5. Setter Mastery and Operations",
    description: "Psychology, engagement, tracking, handoffs, pacing, and daily execution.",
    sections: ["psych", "engage", "pacing"],
  },
];

function matchSections(query: string): Set<TabId> | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const matched = new Set<TabId>();
  for (const s of SECTIONS) {
    const tags = SEARCH_TAGS[s.id] || [];
    const hay = [s.heading.toLowerCase(), ...tags].join(" | ");
    if (hay.includes(q)) matched.add(s.id);
    else if (s.cards.some(c => (c.title + " " + (c.subtitle || "")).toLowerCase().includes(q))) matched.add(s.id);
  }
  return matched;
}

// ---------- Session Counter (aligned with EOD report format) ----------
type Counter = { contacted: number; dials: number; sets: number; convos: number; date: string };
// The rep's LOCAL day — must match the EOD form's report_date basis exactly,
// or a sync after midnight UTC lands on (and overwrites) the wrong day.
const todayKey = () => new Intl.DateTimeFormat("en-CA").format(new Date());
const emptyCounter = (): Counter => ({ contacted: 0, dials: 0, sets: 0, convos: 0, date: todayKey() });
const saveCounter = (c: Counter) => { try { localStorage.setItem("isa:counter", JSON.stringify(c)); } catch { /* ignore */ } };

const COUNTER_FIELDS: { key: keyof Omit<Counter, "date">; label: string; full: string }[] = [
  { key: "contacted", label: "Contact", full: "Followers contacted" },
  { key: "dials", label: "Dials", full: "Dials" },
  { key: "sets", label: "Sets", full: "Sets (call booked)" },
  { key: "convos", label: "Convos", full: "Conversations" },
];

function Toolbar({ dark, setDark, onNotes, counter, setCounter, onReset, onHelp }: { dark: boolean; setDark: (v: boolean) => void; onNotes: () => void; counter: Counter; setCounter: (c: Counter) => void; onReset: () => void; onHelp: () => void }) {
  const { zoomIn, zoomOut } = useControls();
  const [pct, setPct] = useState(55);
  useTransformEffect(({ state }) => { setPct(Math.round(state.scale * 100)); });
  const bump = (k: keyof Omit<Counter, "date">, d: number) => {
    const next = { ...counter, [k]: Math.max(0, counter[k] + d) };
    setCounter(next);
  };
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-background border border-border rounded-full shadow-lg px-2 py-1.5 max-w-[calc(100%-16px)] overflow-x-auto no-scrollbar">
      <button onClick={() => zoomOut(0.15)} className="w-8 h-8 shrink-0 rounded-full hover:bg-muted flex items-center justify-center" title="Zoom out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
      </button>
      <span className="text-sm tabular-nums w-12 text-center shrink-0">{pct}%</span>
      <button onClick={() => zoomIn(0.15)} className="w-8 h-8 shrink-0 rounded-full hover:bg-muted flex items-center justify-center" title="Zoom in">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <div className="w-px h-5 bg-border mx-1 shrink-0" />
      <button onClick={onReset} className="h-8 px-3 shrink-0 rounded-full hover:bg-muted flex items-center gap-1.5 text-xs font-semibold" title="Reset to 100% and scroll to top">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
        Reset
      </button>
      <div className="w-px h-5 bg-border mx-1 shrink-0" />
      {/* Session counter — matches EOD report format */}
      {COUNTER_FIELDS.map(({ key, label, full }) => (
        <div key={key} className="flex items-center h-8 shrink-0 rounded-full bg-muted/60 pl-1.5 pr-1 gap-1" title={full}>
          <span className="text-[10px] text-muted-foreground font-semibold">{label}</span>
          <button onClick={() => bump(key, -1)} className="w-5 h-5 rounded-full bg-background hover:bg-foreground hover:text-background flex items-center justify-center text-xs font-semibold" title={`-1 ${full}`}>−</button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={counter[key]}
            onFocus={e => e.currentTarget.select()}
            onChange={e => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
              setCounter({ ...counter, [key]: Number.isFinite(n) ? Math.max(0, n) : 0 });
            }}
            className="w-8 text-sm font-medium tabular-nums text-foreground text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-ring rounded"
            aria-label={full}
          />
          <button onClick={() => bump(key, 1)} className="w-5 h-5 rounded-full bg-background hover:bg-foreground hover:text-background flex items-center justify-center text-xs font-semibold" title={`+1 ${full}`}>+</button>
        </div>
      ))}
      <button
        onClick={() => setCounter({ ...counter, contacted: 0, dials: 0, sets: 0, convos: 0 })}
        className="w-8 h-8 shrink-0 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
        title="Reset session counters to 0"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
      </button>
      <div className="w-px h-5 bg-border mx-1 shrink-0" />
      <button onClick={onNotes} className="h-8 px-3 shrink-0 rounded-full hover:bg-muted flex items-center gap-1.5 text-xs font-semibold" title="Pre-call notes & EOD report">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8l5-5z"/><path d="M9 3v5H4"/></svg>
        Notes
      </button>
      <a href="/print" target="_blank" rel="noopener" className="h-8 px-3 shrink-0 rounded-full hover:bg-muted flex items-center gap-1.5 text-xs font-semibold" title="Print / one-pager">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
        Print
      </a>
      <button onClick={onHelp} className="w-8 h-8 shrink-0 rounded-full hover:bg-muted flex items-center justify-center text-xs font-semibold" title="Keyboard shortcuts (?)">?</button>
      <button onClick={() => setDark(!dark)} className="w-8 h-8 shrink-0 rounded-full hover:bg-muted flex items-center justify-center" title={dark ? "Light mode" : "Dark mode"}>
        {dark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        )}
      </button>
    </div>
  );
}

function Header({ onJumpGroup, onOpenWorkflow, query, setQuery, innerRef }: { onJumpGroup: (id: string) => void; onOpenWorkflow: () => void; query: string; setQuery: (v: string) => void; innerRef?: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={innerRef} className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-6 py-2 sm:py-3 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img src={logoAsset.url} alt="Ivy Sales Academy" className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 object-contain" loading="eager" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-foreground leading-tight truncate">Script Library</h1>
            <p className="hidden sm:block text-xs text-muted-foreground mt-0.5 truncate">Ordered from inbound setting to daily operations</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onOpenWorkflow} className="px-2.5 sm:px-3 py-2 rounded-md border border-border bg-card text-xs font-semibold hover:bg-muted transition" type="button">← Workflow</button>
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              id="isa-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…  (press /)"
              className="text-xs bg-card border border-border rounded-full pl-7 pr-3 py-2 w-32 sm:w-56 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-2 sm:ml-12 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap items-center">
        {LIBRARY_GROUPS.map(group => (
          <button
            key={group.id}
            onClick={() => onJumpGroup(group.id)}
            className="min-h-9 text-[10px] sm:text-[11px] font-semibold text-foreground px-3 rounded-full whitespace-nowrap border border-border bg-card hover:bg-muted hover:border-foreground/25 transition shrink-0"
          >{group.title}</button>
        ))}
        <span className="hidden sm:inline-block w-px h-4 bg-border mx-1" />
        {CONSTRAINT_CHIPS.map(c => {
          const active = query === c.query;
          return (
            <button
              key={c.label}
              onClick={() => setQuery(active ? "" : c.query)}
              className="text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full whitespace-nowrap border shrink-0 transition"
              style={active
                ? { backgroundColor: c.color, color: "#fff", borderColor: c.color }
                : { color: c.color, borderColor: `color-mix(in oklab, ${c.color} 50%, transparent)`, backgroundColor: "transparent" }}
              title={`Filter: ${c.label} objections & content`}
            >{c.label}</button>
          );
        })}
      </div>
      <div className="hidden sm:flex gap-1.5 mt-1.5 ml-12 items-center flex-wrap">
        <span className="text-[10px] text-muted-foreground">Try:</span>
        {SUGGESTIONS.map(s => {
          const active = query === s;
          return (
            <button
              key={s}
              onClick={() => setQuery(active ? "" : s)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "border-border/70 text-muted-foreground hover:text-foreground hover:border-foreground/40"
              }`}
            >
              {s}
            </button>
          );
        })}
        {query && (
          <button
            onClick={() => setQuery("")}
            className="text-[10px] px-2 py-0.5 rounded-full text-muted-foreground hover:text-foreground"
            title="Clear search"
          >
            clear ✕
          </button>
        )}
      </div>
    </div>
  );
}

function WorkflowHeader({ onJump, onOpenLibrary, guideCollapsed, onToggleGuide, innerRef }: { onJump: (id: string) => void; onOpenLibrary: () => void; guideCollapsed: boolean; onToggleGuide: () => void; innerRef?: React.RefObject<HTMLDivElement | null> }) {
  return (
    <header ref={innerRef} className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={logoAsset.url} alt="Ivy Sales Academy" className="w-9 h-9 shrink-0 object-contain" loading="eager" />
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-foreground leading-tight truncate">Setter Workflow</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">Follow steps 1 to 7 in order</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onToggleGuide} className="hidden lg:block px-3 py-2 rounded-md border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition" type="button">{guideCollapsed ? "Show guide" : "Hide guide"}</button>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
            <span className="px-3 py-2 rounded-md bg-background shadow-sm text-xs font-semibold text-foreground">Workflow</span>
            <button onClick={onOpenLibrary} className="px-3 py-2 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-background/70 transition" type="button">Script Library</button>
          </div>
        </div>
      </div>
      <nav aria-label="Setter workflow steps" className="px-4 sm:px-6 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
        {WORKFLOW_STEPS.map((step, index) => (
          <button
            key={step.id}
            onClick={() => onJump(step.id)}
            className="min-h-10 px-3 rounded-full border border-border bg-card hover:border-foreground/30 hover:bg-muted text-xs font-semibold whitespace-nowrap transition shrink-0"
            type="button"
          >
            <span className="text-muted-foreground mr-1.5">{index + 1}</span>{step.short}
          </button>
        ))}
      </nav>
    </header>
  );
}

function SectionHeading({ id, color, text }: { id: TabId; color: string; text: string }) {
  return (
    <div id={`sec-${id}`} data-section={id} className="col-span-full flex items-center gap-2 mt-6 mb-2">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <h2 className="text-[11px] font-semibold text-foreground/80">{text}</h2>
    </div>
  );
}

const Card = React.memo(function Card({ cardId, color, title, subtitle, children, matchQuery, wide }: { cardId: string; color: string; title: string; subtitle?: string; children: React.ReactNode; matchQuery: string; wide?: boolean }) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const hadMarksRef = useRef(false);
  const [matches, setMatches] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);


  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#${cardId}`;
    navigator.clipboard?.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };

  // Highlight matched words & detect card match.
  // Hot path — runs for every card whenever the search query changes.
  // Optimizations:
  //  - Skip all DOM work when there's no query AND no prior marks to clean up
  //  - Skip walker entirely when query is < 2 chars (avoids full-tree walks on single-key typing)
  //  - Use textContent (no layout) instead of innerText (forces synchronous layout)
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const q = matchQuery.trim();

    // Fast path: nothing to do and nothing to clean up
    if (!q && !hadMarksRef.current) {
      setMatches(false);
      return;
    }

    // Clean up prior highlights only if we actually added them
    if (hadMarksRef.current) {
      root.querySelectorAll("mark.hl-match").forEach(m => {
        const t = document.createTextNode(m.textContent || "");
        m.parentNode?.replaceChild(t, m);
      });
      root.normalize();
      hadMarksRef.current = false;
    }

    if (!q) { setMatches(false); return; }

    // Cheap text match check first (textContent avoids layout, unlike innerText)
    const cardText = (title + " " + (subtitle || "") + " " + (root.textContent || "")).toLowerCase();
    const hit = cardText.includes(q.toLowerCase());
    setMatches(hit);
    if (!hit) return;

    // Skip expensive DOM walk for single-char queries — visual highlight isn't worth the cost
    if (q.length < 2) return;

    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const tn = n as Text;
      if (tn.parentElement?.tagName === "MARK") continue;
      if (re.test(tn.data)) nodes.push(tn);
      re.lastIndex = 0;
    }
    if (!nodes.length) return;
    nodes.forEach(tn => {
      const parts = tn.data.split(re);
      const matchesArr = tn.data.match(re) || [];
      if (!matchesArr.length) return;
      const frag = document.createDocumentFragment();
      parts.forEach((p, i) => {
        frag.appendChild(document.createTextNode(p));
        if (i < matchesArr.length) {
          const m = document.createElement("mark");
          m.className = "hl-match";
          m.textContent = matchesArr[i];
          frag.appendChild(m);
        }
      });
      tn.parentNode?.replaceChild(frag, tn);
    });
    hadMarksRef.current = true;
  }, [matchQuery, title, subtitle]);

  return (
    <div id={cardId} className={`${wide ? "w-full" : "w-[280px]"} bg-card rounded-lg shadow-sm border border-border overflow-hidden flex flex-col ${matches ? "card-matched" : ""}`}>
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="p-4 flex-1 relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-foreground leading-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <button onClick={copyLink} className="text-[9px] font-semibold text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/70 bg-background/60" title="Copy shareable link to this card">
              {linkCopied ? "Copied" : "Link"}
            </button>
          </div>
        </div>
        <div ref={bodyRef} className="mt-3">{children}</div>
      </div>
    </div>
  );
});

function getWorkflowCard(ref: WorkflowCardRef) {
  const section = SECTIONS.find(candidate => candidate.id === ref.section);
  const card = section?.cards.find(candidate => candidate.title === ref.title);
  if (!section || !card) throw new Error(`Missing workflow card: ${ref.section} / ${ref.title}`);
  return { card, color: section.color };
}

const WorkflowView = React.memo(function WorkflowView({ headerH, guideCollapsed }: { headerH: number; guideCollapsed: boolean }) {
  return (
    <main className="min-h-screen bg-background overflow-y-auto pb-28" style={{ paddingTop: headerH + 24 }}>
      <div className="w-full max-w-none px-4 sm:px-6">
        <section className="mb-12 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">New setter start here</p>
          <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">One conversation. Seven steps. Follow them in order.</h2>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted-foreground">Read the instruction, use the exact script that matches the lead, and only move forward when the condition is met.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-lg border border-border bg-card px-4 py-3"><b className="block text-foreground">One question</b><span className="text-muted-foreground">Never paste a questionnaire.</span></div>
            <div className="rounded-lg border border-border bg-card px-4 py-3"><b className="block text-foreground">React first</b><span className="text-muted-foreground">Make every next question connected.</span></div>
            <div className="rounded-lg border border-border bg-card px-4 py-3"><b className="block text-foreground">Route honestly</b><span className="text-muted-foreground">Book, nurture, free help, or disqualify.</span></div>
          </div>
        </section>

        <div className="space-y-14">
          {WORKFLOW_STEPS.map((step, stepIndex) => (
            <section key={step.id} id={`workflow-${step.id}`} className="scroll-mt-40">
              <div className={guideCollapsed ? "space-y-4" : "grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8"}>
                {guideCollapsed ? (
                  <div className="hidden lg:flex items-center gap-3 border-b border-border pb-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{stepIndex + 1}</span>
                    <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                    <span className="text-xs text-muted-foreground">Move on when: {step.moveOnWhen}</span>
                  </div>
                ) : (
                <div className="lg:sticky lg:top-40 lg:self-start">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">{stepIndex + 1}</span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{step.short}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.instruction}</p>
                  <div className="mt-4 border-l-2 border-success pl-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-success-fg">Move on when</p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground/80">{step.moveOnWhen}</p>
                  </div>
                </div>
                )}
                <div className="grid items-start gap-4 md:grid-cols-2">
                  {step.cards.map((ref, cardIndex) => {
                    const { card, color } = getWorkflowCard(ref);
                    return (
                      <Card
                        key={`${ref.section}-${ref.title}`}
                        cardId={`workflow-card-${step.id}-${cardIndex}`}
                        color={color}
                        title={ref.label ?? card.title}
                        subtitle={card.subtitle}
                        matchQuery=""
                        wide
                      >
                        {card.body}
                      </Card>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
});

const LibraryView = React.memo(function LibraryView({ headerH, matched, query }: { headerH: number; matched: Set<TabId> | null; query: string }) {
  return (
    <main className="min-h-screen bg-background pb-28" style={{ paddingTop: headerH + 24 }}>
      <div className="w-full max-w-none px-4 sm:px-6">
        <section className="mb-12 max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Live conversation reference</p>
          <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Find the stage you are in. Use only what comes next.</h2>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted-foreground">Inbound comes first. Financial qualification is its own required stage. Outbound, closing, follow-up, and operations stay separated so they do not interrupt the live inbound path.</p>
        </section>

        <div className="space-y-16">
          {LIBRARY_GROUPS.map(group => (
            <section key={group.id} id={`library-group-${group.id}`} className="scroll-mt-44">
              <div className="mb-7 border-b border-border pb-4">
                <h3 className="text-xl font-semibold tracking-tight text-foreground">{group.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
              </div>
              <div className="space-y-12">
                {group.sections.map(sectionId => {
                  const section = SECTIONS.find(candidate => candidate.id === sectionId);
                  if (!section) return null;
                  const dim = matched && !matched.has(section.id);
                  return (
                    <section key={section.id} id={`sec-${section.id}`} data-section={section.id} className="scroll-mt-44" style={{ opacity: dim ? 0.2 : 1, transition: "opacity 200ms" }}>
                      <div className="mb-4 flex items-center gap-3">
                        <span className="h-3 w-1 rounded-full" style={{ backgroundColor: section.color }} />
                        <h4 className="text-base font-semibold text-foreground">{section.heading}</h4>
                        <span className="text-xs text-muted-foreground">{section.cards.length} cards</span>
                      </div>
                      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {section.cards.map((card, cardIndex) => (
                          <Card
                            key={`${section.id}-${cardIndex}`}
                            cardId={`card-${section.id}-${cardIndex}`}
                            color={section.color}
                            title={card.title}
                            subtitle={card.subtitle}
                            matchQuery={dim ? "" : query}
                            wide
                          >
                            {card.body}
                          </Card>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
});


const Canvas = React.memo(function Canvas({ matched, query }: { matched: Set<TabId> | null; query: string }) {
  return (
    <div className="canvas-bg inline-block" style={{ padding: `${CANVAS_PAD_TOP}px ${CANVAS_PAD_LEFT}px 40px` }}>
      <div className="flex flex-col gap-8">
        {SECTIONS.map(section => {
          const dim = matched && !matched.has(section.id);
          return (
            <div
              key={section.id}
              style={{ opacity: dim ? 0.2 : 1, transition: "opacity 200ms" }}
            >
              <SectionHeading id={section.id} color={section.color} text={section.heading} />
              <div className="flex flex-nowrap gap-4 items-start w-max">
                {section.cards.map((c, i) => (
                  <Card key={i} cardId={`card-${section.id}-${i}`} color={section.color} title={c.title} subtitle={c.subtitle} matchQuery={dim ? "" : query}>{c.body}</Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const rows: [string, string][] = [
    ["/", "Focus search"],
    ["?", "Toggle this help"],
    ["Esc", "Clear search / close modals"],
  ];
  return (
    <div className="isa-modal fixed inset-0 overflow-y-auto z-[70] bg-black/40 backdrop-blur-sm flex p-4" onClick={onClose} data-no-canvas-scroll>
      <div className="m-auto isa-modal bg-card border border-border rounded-lg shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()} data-no-canvas-scroll>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Keyboard shortcuts</h3>
          <button onClick={onClose} className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center text-muted-foreground" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4 space-y-2">
          {rows.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <kbd className="px-2 py-0.5 rounded border border-border bg-muted/60 text-[11px]">{k}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PRECALL_TPL = `PRE-CALL NOTES

Name / handle:
Age range:
Location:
Employment (job / student / in between):
Income / savings shared:
Hours available per week:
Family status (parents / wife aware):
Hijrah timeline:

LEAD TYPE (Exploring / Stuck / Learning / In the Game):
CURRENT STAGE (1–8):
PRIMARY CONSTRAINT (Money / Time / Belief):
READINESS (This month / Next few months / Exploring):
QUALIFICATION RESULT (Green / Amber / Red):
ROUTE (Book / Nurture / Free community / Disqualify):
DISQUALIFIER OR GAP (if any):

Pain points (in his words):

Objections raised + how handled:

Proof sent:
Conversation vibe (hot / cautious / skeptical / nervous):
Last interaction:
Next follow-up:

Call outcome:`;

const EOD_DEFAULT_BODY = `Wins:
Losses / lessons:
Objections seen today:
Tomorrow's focus:`;

const composeEod = (c: Counter, body: string) => `EOD REPORT · ${c.date}

Followers contacted: ${c.contacted}
Dials: ${c.dials}
Sets: ${c.sets}
Conversations: ${c.convos}

${body}`;

const parseEodBody = (text: string, fallback: string) => {
  const m = text.match(/Conversations:[^\n]*\n\n([\s\S]*)$/);
  return m ? m[1] : fallback;
};

function NotesModal({ open, onClose, counter, setCounter }: { open: boolean; onClose: () => void; counter: Counter; setCounter: (c: Counter) => void }) {
  const [tab, setTab] = useState<"precall" | "eod">("precall");
  const [precall, setPrecall] = useState(PRECALL_TPL);
  const [eodBody, setEodBody] = useState(EOD_DEFAULT_BODY);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  if (!open) return null;

  const eod = composeEod(counter, eodBody);
  const text = tab === "precall" ? precall : eod;
  const onChangeText = (v: string) => {
    if (tab === "precall") setPrecall(v);
    else setEodBody(parseEodBody(v, eodBody));
  };
  const resetTpl = () => {
    if (tab === "precall") {
      setPrecall(PRECALL_TPL);
    } else {
      setEodBody(EOD_DEFAULT_BODY);
      setCounter({ ...counter, contacted: 0, dials: 0, sets: 0, convos: 0 });
    }
  };

  const copy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const syncToEod = async () => {
    setSyncing(true);
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) { setSyncing(false); return toast.error("Not signed in"); }

    // Parse narrative sections from the current EOD body
    const grab = (label: string) => {
      const m = eodBody.match(new RegExp(`${label}:\\s*([^\\n]*(?:\\n(?!\\w+:)[^\\n]*)*)`, "i"));
      return (m?.[1] ?? "").trim() || null;
    };

    // Submitted EODs are operational history. Sync can create the day's record
    // once, but it must never replace an existing submission.
    const { data: existing } = await supabase.from("eods")
      .select("id").eq("is_demo", false).eq("user_id", userId).eq("report_date", counter.date).maybeSingle();
    if (existing) {
      setSyncing(false);
      return toast.error("An EOD is already submitted for this date and is locked.");
    }

    const payload = {
      user_id: userId,
      report_date: counter.date,
      dms_sent: counter.contacted,
      convos_started: counter.convos,
      calls_booked: counter.sets,
      calls_scheduled: counter.sets,
      wins: grab("Wins"),
      blockers: grab("Losses / lessons") ?? grab("Losses") ?? grab("Objections seen today"),
      tomorrow_focus: grab("Tomorrow's focus") ?? grab("Tomorrow"),
    };

    const { error } = await supabase.from("eods").insert(payload as never);
    setSyncing(false);
    if (error?.code === "23505") toast.error("An EOD is already submitted for this date and is locked.");
    else if (error) toast.error(error.message);
    else toast.success("Synced to EOD Reports");
  };

  const stopWheel = (e: React.WheelEvent) => e.stopPropagation();

  return (
    <div className="isa-modal fixed inset-0 overflow-y-auto z-[60] bg-black/40 backdrop-blur-sm flex p-4" onClick={onClose} onWheel={stopWheel} data-no-canvas-scroll>
      <div className="m-auto isa-modal bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()} onWheel={stopWheel} data-no-canvas-scroll>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            <button onClick={() => setTab("precall")} className={`px-3 py-1 text-xs font-semibold rounded ${tab === "precall" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>Pre-call</button>
            <button onClick={() => setTab("eod")} className={`px-3 py-1 text-xs font-semibold rounded ${tab === "eod" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>EOD report</button>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center text-muted-foreground" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground px-4 pt-2">
          {tab === "precall" ? "Fill in during the DM, copy to hand off to the closer." : "Auto-filled from your session counters. Copy, or sync directly to your EOD Reports."}
        </p>
        <textarea
          value={text}
          onChange={e => onChangeText(e.target.value)}
          onWheel={stopWheel}
          className="flex-1 min-h-[380px] max-h-[60vh] p-3 mt-2 text-xs bg-background text-foreground resize-none focus:outline-none overflow-auto"
        />
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
          <button onClick={resetTpl} className="text-xs text-muted-foreground hover:text-foreground">Reset template</button>
          <div className="flex items-center gap-2">
            {tab === "eod" && (
              <button onClick={syncToEod} disabled={syncing} className="px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold disabled:opacity-60">
                {syncing ? "Syncing…" : "Sync to EOD Reports"}
              </button>
            )}
            <button onClick={copy} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MobileView = React.memo(function MobileView({ matched, query, headerH }: { matched: Set<TabId> | null; query: string; headerH: number }) {
  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: headerH + 8 }}>
      <div className="px-3 space-y-6">
        {SECTIONS.map(section => {
          const dim = matched && !matched.has(section.id);
          return (
            <section
              key={section.id}
              id={`sec-${section.id}`}
              data-section={section.id}
              className="scroll-mt-4"
              style={{ opacity: dim ? 0.35 : 1, transition: "opacity 200ms" }}
            >
              <div className="flex items-center gap-2 mb-3 sticky z-10 bg-background/95 backdrop-blur-sm py-2 -mx-3 px-3 border-b border-border" style={{ top: headerH }}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: section.color }} />
                <h2 className="text-[12px] font-semibold text-foreground truncate">{section.heading}</h2>
              </div>
              <div className="flex flex-col gap-3">
                {section.cards.map((c, i) => (
                  <Card
                    key={i}
                    cardId={`card-${section.id}-${i}`}
                    color={section.color}
                    title={c.title}
                    subtitle={c.subtitle}
                    matchQuery={dim ? "" : query}
                    wide
                  >{c.body}</Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
});

function MobileToolbar({ dark, setDark, onNotes, counter, setCounter, onHelp }: { dark: boolean; setDark: (v: boolean) => void; onNotes: () => void; counter: Counter; setCounter: (c: Counter) => void; onHelp: () => void }) {
  const bump = (k: keyof Omit<Counter, "date">, d: number) => {
    setCounter({ ...counter, [k]: Math.max(0, counter[k] + d) });
  };
  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-background border border-border rounded-full shadow-lg px-2 py-1.5 max-w-[calc(100%-16px)] overflow-x-auto no-scrollbar">
      {COUNTER_FIELDS.map(({ key, label, full }) => (
        <div key={key} className="flex items-center h-8 shrink-0 rounded-full bg-muted/60 pl-1.5 pr-1 gap-1" title={full}>
          <span className="text-[10px] text-muted-foreground font-semibold">{label}</span>
          <button onClick={() => bump(key, -1)} className="w-5 h-5 rounded-full bg-background flex items-center justify-center text-xs font-semibold">−</button>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={counter[key]}
            onFocus={e => e.currentTarget.select()}
            onChange={e => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
              setCounter({ ...counter, [key]: Number.isFinite(n) ? Math.max(0, n) : 0 });
            }}
            className="w-8 text-sm font-medium tabular-nums text-foreground text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-ring rounded"
            aria-label={full}
          />
          <button onClick={() => bump(key, 1)} className="w-5 h-5 rounded-full bg-background flex items-center justify-center text-xs font-semibold">+</button>
        </div>
      ))}
      <button
        onClick={() => setCounter({ ...counter, contacted: 0, dials: 0, sets: 0, convos: 0 })}
        className="w-8 h-8 shrink-0 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
        title="Reset counters"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
      </button>
      <div className="w-px h-5 bg-border mx-1 shrink-0" />
      <button onClick={onNotes} className="h-8 px-3 shrink-0 rounded-full hover:bg-muted flex items-center gap-1.5 text-xs font-semibold">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8l5-5z"/><path d="M9 3v5H4"/></svg>
        Notes
      </button>
      <button onClick={onHelp} className="w-8 h-8 shrink-0 rounded-full hover:bg-muted flex items-center justify-center text-xs font-semibold" title="Help">?</button>
      <button onClick={() => setDark(!dark)} className="w-8 h-8 shrink-0 rounded-full hover:bg-muted flex items-center justify-center" title={dark ? "Light mode" : "Dark mode"}>
        {dark ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
        )}
      </button>
    </div>
  );
}



function Index() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = useState(HEADER_HEIGHT_DESKTOP);
  const [mode, setMode] = useState<PageMode>("workflow");
  const [guideCollapsed, setGuideCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [dark, setDark] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [counter, setCounterState] = useState<Counter>(emptyCounter);
  const matched = useMemo(() => matchSections(deferredQuery), [deferredQuery]);


  // Rehydrate persisted preferences after SSR to avoid hydration mismatches
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    try {
      setDark(document.documentElement.classList.contains("dark"));
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem("isa:counter");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Counter>;
        if (parsed.date === todayKey()) {
          setCounterState({ ...emptyCounter(), ...parsed } as Counter);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Measure actual header height so the canvas is padded correctly at any zoom
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderH(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, [mode]);


  const setCounter = useCallback((c: Counter) => {
    setCounterState(c);
    saveCounter(c);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("isa-theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  }, [dark]);


  const scrollToEl = useCallback((el: HTMLElement) => {
    const hH = headerRef.current?.getBoundingClientRect().height ?? headerH;
    const top = el.getBoundingClientRect().top + window.scrollY - hH - 12;
    window.scrollTo({ top, behavior: "smooth" });
  }, [headerH]);

  const jumpToWorkflow = useCallback((id: string) => {
    const el = document.getElementById(`workflow-${id}`);
    if (el) scrollToEl(el);
  }, [scrollToEl]);

  const jumpToLibraryGroup = useCallback((id: string) => {
    const el = document.getElementById(`library-group-${id}`);
    if (el) scrollToEl(el);
  }, [scrollToEl]);

  const jumpTo = useCallback((id: TabId) => {
    const el = document.getElementById(`sec-${id}`);
    if (!el) return;
    scrollToEl(el);
  }, [scrollToEl]);

  useEffect(() => {
    if (mode === "library" && matched && matched.size > 0) {
      const first = SECTIONS.find(s => matched.has(s.id));
      if (first) setTimeout(() => jumpTo(first.id), 60);
    }
  }, [mode, query, matched, jumpTo]);

  // Deep-link: on load & on hashchange, jump to #card-xxx or #sec-xxx
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.slice(1);
      if (!h) return;
      const el = document.getElementById(h);
      if (el) {
        setTimeout(() => {
          scrollToEl(el);
          el.classList.remove("card-focus-flash");
          // reflow to restart animation if same hash re-triggered
          void (el as HTMLElement).offsetWidth;
          el.classList.add("card-focus-flash");
          setTimeout(() => el.classList.remove("card-focus-flash"), 2600);
        }, 80);
      }
    };
    setTimeout(handleHash, 200);
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [scrollToEl]);

  // Keyboard shortcuts: /, ?, Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "Escape") {
        if (helpOpen) { setHelpOpen(false); return; }
        if (notesOpen) { setNotesOpen(false); return; }
        if (query) { setQuery(""); (document.getElementById("isa-search") as HTMLInputElement | null)?.blur(); return; }
        return;
      }
      if (inField) return;
      if (e.key === "/") { e.preventDefault(); (document.getElementById("isa-search") as HTMLInputElement | null)?.focus(); return; }
      if (e.key === "?" ) { e.preventDefault(); setHelpOpen(v => !v); return; }

    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen, notesOpen, query]);

  if (mode === "workflow") {
    return (
      <div ref={containerRef} className="relative min-h-screen bg-background">
        <WorkflowView headerH={headerH} guideCollapsed={guideCollapsed} />
        <WorkflowHeader innerRef={headerRef} onJump={jumpToWorkflow} onOpenLibrary={() => setMode("library")} guideCollapsed={guideCollapsed} onToggleGuide={() => setGuideCollapsed(value => !value)} />
        <NotesModal open={notesOpen} onClose={() => setNotesOpen(false)} counter={counter} setCounter={setCounter} />
        <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative min-h-screen bg-background">
      <LibraryView headerH={headerH} matched={matched} query={deferredQuery} />
      <Header innerRef={headerRef} onJumpGroup={jumpToLibraryGroup} onOpenWorkflow={() => setMode("workflow")} query={query} setQuery={setQuery} />
      <MobileToolbar dark={dark} setDark={setDark} onNotes={() => setNotesOpen(true)} counter={counter} setCounter={setCounter} onHelp={() => setHelpOpen(true)} />
      <NotesModal open={notesOpen} onClose={() => setNotesOpen(false)} counter={counter} setCounter={setCounter} />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
