import { createFileRoute } from "@tanstack/react-router";
import { TransformWrapper, TransformComponent, useControls, useTransformEffect, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { useRef, useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { TABS, type TabId } from "@/data/content";
import { SECTIONS } from "@/data/sections";
import logoAsset from "@/assets/isa-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ivy Sales Academy — Setting Mastery" },
      { name: "description", content: "Complete system: conversation flows, scripts, objection handling, psychology, engagement & operations" },
    ],
  }),
  component: Index,
});

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
  { label: "Money", query: "money", color: "var(--tab-dmclose)" },
  { label: "Time", query: "time", color: "var(--tab-conv)" },
  { label: "Belief", query: "belief", color: "var(--tab-psych)" },
  { label: "Deen", query: "deen", color: "var(--tab-engage)" },
];

const SEARCH_TAGS: Record<TabId, string[]> = {
  stages: ["stage", "process", "steps", "flow", "profile", "opener", "problem", "deep dive", "constraint", "routing", "recommendation", "close", "calendly", "exploring", "stuck", "learning", "in the game", "identity", "quick check", "icp"],
  inbound: ["inbound", "path", "keyword", "reply", "permission close", ...SYNONYMS.money, "halal", "haram", "5-minute", "five minute"],
  outbound: ["outbound", "opener", "dm", "cold", "prospect", "targeting", "who to dm", "leads", "bad lead", "green flag", "red flag", "hot", "warm", "response time"],
  story: ["story", "reply", "engagement", "reaction", "posts", "instagram", "gym", "win", "struggle", "quote", "motivation"],
  conv: ["conversation", "conv", "flow", "value drop", "youtube", "trust", "nurture", "warm", "brother", "self-identify", ...SYNONYMS.followup, "case study"],
  dmclose: ["dm close", "close", ...SYNONYMS.objections, ...SYNONYMS.money, ...SYNONYMS.time, ...SYNONYMS.family, ...SYNONYMS.belief, ...SYNONYMS.deen, "burned", "scammed", "trust", "think about", "not ready", "3/5/7", "binary"],
  psych: ["psychology", "principle", ...SYNONYMS.belief, "authority", "empathy", "emotion", "trust", "expect", "need", "destination"],
  engage: ["engagement", "engage", "story", ...SYNONYMS.followup, "friend", "warm", "cold", "testimonial", "sunday", "pipeline", "proof", "student", "case study"],
  pacing: ["pacing", "ops", "operations", "schedule", "tracking", "crm", "targets", "kpi", "metrics", "daily", "sunday", "non-negotiable", "personality", "empathy phrases", "handoff", "closer", "benchmark", "stats", "feedback"],
};

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
const todayKey = () => new Date().toISOString().slice(0, 10);
const emptyCounter = (): Counter => ({ contacted: 0, dials: 0, sets: 0, convos: 0, date: todayKey() });
const loadCounter = (): Counter => {
  if (typeof localStorage === "undefined") return emptyCounter();
  try {
    const raw = localStorage.getItem("isa:counter");
    if (!raw) return emptyCounter();
    const parsed = JSON.parse(raw) as Partial<Counter>;
    if (parsed.date !== todayKey()) return emptyCounter();
    return { ...emptyCounter(), ...parsed } as Counter;
  } catch { return emptyCounter(); }
};
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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-background border border-border rounded-full shadow-lg px-2 py-1.5 max-w-[calc(100vw-16px)] overflow-x-auto no-scrollbar">
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
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
          <button onClick={() => bump(key, -1)} className="w-5 h-5 rounded-full bg-background hover:bg-foreground hover:text-background flex items-center justify-center text-xs font-bold" title={`-1 ${full}`}>−</button>
          <span className="text-sm font-bold tabular-nums text-foreground min-w-[16px] text-center">{counter[key]}</span>
          <button onClick={() => bump(key, 1)} className="w-5 h-5 rounded-full bg-background hover:bg-foreground hover:text-background flex items-center justify-center text-xs font-bold" title={`+1 ${full}`}>+</button>
        </div>
      ))}
      <div className="w-px h-5 bg-border mx-1 shrink-0" />
      <button onClick={onNotes} className="h-8 px-3 shrink-0 rounded-full hover:bg-muted flex items-center gap-1.5 text-xs font-semibold" title="Pre-call notes & EOD report">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8l5-5z"/><path d="M9 3v5H4"/></svg>
        Notes
      </button>
      <a href="/print" target="_blank" rel="noopener" className="h-8 px-3 shrink-0 rounded-full hover:bg-muted flex items-center gap-1.5 text-xs font-semibold" title="Print / one-pager">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
        Print
      </a>
      <button onClick={onHelp} className="w-8 h-8 shrink-0 rounded-full hover:bg-muted flex items-center justify-center text-xs font-bold" title="Keyboard shortcuts (?)">?</button>
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

function Header({ onJump, query, setQuery }: { onJump: (id: TabId) => void; query: string; setQuery: (v: string) => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-6 py-2 sm:py-3 bg-background/95 backdrop-blur-sm border-b border-border/60">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img src={logoAsset.url} alt="Ivy Sales Academy" className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 object-contain" loading="eager" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight truncate">Ivy Sales Academy</h1>
            <p className="hidden sm:block text-xs text-muted-foreground mt-0.5 truncate">Complete system: conversation flows, scripts, objection handling, psychology, engagement & operations</p>
          </div>
        </div>
        <div className="relative shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            id="isa-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search…  (press /)"
            className="text-xs bg-card border border-border rounded-full pl-7 pr-3 py-1.5 w-32 sm:w-56 focus:outline-none focus:ring-2 focus:ring-[color:var(--tab-stages)]/30"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-2 sm:ml-12 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap items-center">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onJump(t.id)}
            className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full whitespace-nowrap hover:opacity-90 transition-opacity shrink-0"
            style={{ backgroundColor: t.color }}
          >{t.label}</button>
        ))}
        <span className="hidden sm:inline-block w-px h-4 bg-border mx-1" />
        {CONSTRAINT_CHIPS.map(c => {
          const active = query === c.query;
          return (
            <button
              key={c.label}
              onClick={() => setQuery(active ? "" : c.query)}
              className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full whitespace-nowrap border shrink-0 transition"
              style={active
                ? { backgroundColor: c.color, color: "#fff", borderColor: c.color }
                : { color: c.color, borderColor: `color-mix(in oklab, ${c.color} 50%, transparent)`, backgroundColor: "transparent" }}
              title={`Filter: ${c.label} objections & content`}
            >{c.label}</button>
          );
        })}
      </div>
      {!query && (
        <div className="hidden sm:flex gap-1.5 mt-1.5 ml-12 items-center flex-wrap">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Try:</span>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => setQuery(s)} className="text-[10px] px-2 py-0.5 rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeading({ id, color, text }: { id: TabId; color: string; text: string }) {
  return (
    <div id={`sec-${id}`} data-section={id} className="col-span-full flex items-center gap-2 mt-6 mb-2">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-foreground/80">{text}</h2>
    </div>
  );
}

function Card({ cardId, color, title, subtitle, children, matchQuery }: { cardId: string; color: string; title: string; subtitle?: string; children: React.ReactNode; matchQuery: string }) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [matches, setMatches] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const copyAll = () => {
    const els = bodyRef.current?.querySelectorAll("[data-quote]");
    if (!els || !els.length) return;
    const txt = Array.from(els).map(e => (e as HTMLElement).innerText.trim()).join("\n\n");
    navigator.clipboard?.writeText(txt);
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#${cardId}`;
    navigator.clipboard?.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };

  // Highlight matched words & detect card match
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    root.querySelectorAll("mark.hl-match").forEach(m => {
      const t = document.createTextNode(m.textContent || "");
      m.parentNode?.replaceChild(t, m);
    });
    root.normalize();
    if (!matchQuery.trim()) { setMatches(false); return; }
    const q = matchQuery.trim();
    const cardText = (title + " " + (subtitle || "") + " " + root.innerText).toLowerCase();
    const hit = cardText.includes(q.toLowerCase());
    setMatches(hit);
    if (!hit) return;
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
  }, [matchQuery, title, subtitle]);

  return (
    <div id={cardId} className={`w-[280px] bg-card rounded-lg shadow-sm border border-border overflow-hidden flex flex-col ${matches ? "card-matched" : ""}`}>
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="p-4 flex-1 relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-foreground leading-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <button onClick={copyAll} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/70 bg-background/60" title="Copy all scripts in this card">
              Copy all
            </button>
            <button onClick={copyLink} className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/70 bg-background/60" title="Copy shareable link to this card">
              {linkCopied ? "Copied" : "Link"}
            </button>
          </div>
        </div>
        <div ref={bodyRef} className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function Canvas({ matched, query }: { matched: Set<TabId> | null; query: string }) {
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
}

function SectionRail({ onJump }: { onJump: (id: TabId) => void }) {
  const [active, setActive] = useState<TabId | null>(null);
  useEffect(() => {
    const onScroll = () => {
      let best: TabId | null = null;
      let bestDist = Infinity;
      const viewportTop = (window.innerWidth < 640 ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT_DESKTOP) + 40;
      for (const s of SECTIONS) {
        const el = document.getElementById(`sec-${s.id}`);
        if (!el) continue;
        const d = Math.abs(el.getBoundingClientRect().top - viewportTop);
        if (d < bestDist) { bestDist = d; best = s.id; }
      }
      if (best) setActive(best);
    };
    const t = setInterval(onScroll, 400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="hidden sm:flex fixed left-2 top-1/2 -translate-y-1/2 z-40 flex-col gap-2 bg-background/80 backdrop-blur-sm border border-border/60 rounded-full py-2 px-1.5">
      {SECTIONS.map(s => (
        <button
          key={s.id}
          onClick={() => onJump(s.id)}
          className="group relative w-4 h-4 flex items-center justify-center"
          title={s.heading}
        >
          <span
            className="rounded-full transition-all"
            style={{
              backgroundColor: s.color,
              width: active === s.id ? 10 : 6,
              height: active === s.id ? 10 : 6,
              opacity: active === s.id ? 1 : 0.55,
            }}
          />
        </button>
      ))}
    </div>
  );
}

function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const rows: [string, string][] = [
    ["/", "Focus search"],
    ["?", "Toggle this help"],
    ["R", "Reset view (100%, top-left)"],
    ["Esc", "Clear search / close modals"],
    ["Ctrl / ⌘ + wheel", "Zoom canvas"],
    ["Two-finger drag", "Pan canvas"],
  ];
  return (
    <div className="isa-modal fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} data-no-canvas-scroll>
      <div className="isa-modal bg-card border border-border rounded-lg shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()} data-no-canvas-scroll>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold">Keyboard shortcuts</h3>
          <button onClick={onClose} className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center text-muted-foreground" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4 space-y-2">
          {rows.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <kbd className="px-2 py-0.5 rounded border border-border bg-muted/60 font-mono text-[11px]">{k}</kbd>
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

Pain points (in his words):

Objections raised + how handled:

Proof sent:
Conversation vibe (hot / cautious / skeptical / nervous):
Last interaction:
Next follow-up:

Call outcome:`;

const eodTemplate = (c: Counter, extra = "") => `EOD REPORT — ${c.date}

Followers contacted: ${c.contacted}
Dials: ${c.dials}
Sets: ${c.sets}
Conversations: ${c.convos}

Wins:
Losses / lessons:
Objections seen today:
Tomorrow's focus:
${extra ? "\nNotes:\n" + extra : ""}`;

function NotesModal({ open, onClose, counter }: { open: boolean; onClose: () => void; counter: Counter }) {
  const [tab, setTab] = useState<"precall" | "eod">("precall");
  const [precall, setPrecall] = useState(PRECALL_TPL);
  const [eod, setEod] = useState(() => eodTemplate(counter));
  const [copied, setCopied] = useState(false);

  // Keep EOD counters in sync when modal opens, unless user has customized
  useEffect(() => {
    if (open && tab === "eod") {
      // Only re-hydrate if it still looks like an untouched template for a different count
      setEod(prev => {
        if (prev.startsWith("EOD REPORT") && !prev.includes("Notes:\n") && !/[A-Za-z]{2,}:\s+\S/.test(prev.split("\n\n").slice(-3).join("\n"))) {
          return eodTemplate(counter);
        }
        return prev;
      });
    }
  }, [open, tab, counter]);

  if (!open) return null;

  const text = tab === "precall" ? precall : eod;
  const setText = tab === "precall" ? setPrecall : setEod;
  const resetTpl = () => tab === "precall" ? setPrecall(PRECALL_TPL) : setEod(eodTemplate(counter));

  const copy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const stopWheel = (e: React.WheelEvent) => e.stopPropagation();

  return (
    <div className="isa-modal fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} onWheel={stopWheel} data-no-canvas-scroll>
      <div className="isa-modal bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()} onWheel={stopWheel} data-no-canvas-scroll>
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
          {tab === "precall" ? "Fill in during the DM, copy to hand off to the closer." : "Auto-filled from your session counters. Copy to paste into your EOD report."}
        </p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onWheel={stopWheel}
          className="flex-1 min-h-[380px] max-h-[60vh] p-3 mt-2 text-xs font-mono bg-background text-foreground resize-none focus:outline-none overflow-auto"
        />
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
          <button onClick={resetTpl} className="text-xs text-muted-foreground hover:text-foreground">Reset template</button>
          <button onClick={copy} className="px-3 py-1.5 rounded-md bg-[color:var(--tab-stages)] text-white text-xs font-semibold hover:opacity-90">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Index() {
  const wrapperRef = useRef<ReactZoomPanPinchRef | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [dark, setDark] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [counter, setCounterState] = useState<Counter>(() => loadCounter());
  const matched = useMemo(() => matchSections(deferredQuery), [deferredQuery]);

  const clampCanvasPosition = useCallback((x: number, y: number, scale: number) => {
    const container = containerRef.current;
    const canvas = container?.querySelector<HTMLElement>(".canvas-bg");
    if (!container || !canvas) return { x, y };

    const rect = container.getBoundingClientRect();
    const isM = rect.width < 640;
    const headerH = isM ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT_DESKTOP;
    // Transform viewport starts BELOW the header, so gutters are viewport-relative
    const viewportW = rect.width;
    const viewportH = rect.height - headerH;
    const leftGutter = 8;
    const rightGutter = 8;
    const topGutter = 8;
    const bottomGutter = 80;
    const scaledW = canvas.offsetWidth * scale;
    const scaledH = canvas.offsetHeight * scale;

    const maxX = leftGutter - CANVAS_PAD_LEFT * scale;
    const minX = Math.min(maxX, viewportW - rightGutter - scaledW);
    const maxY = topGutter - CANVAS_PAD_TOP * scale;
    const minY = Math.min(maxY, viewportH - bottomGutter - scaledH);

    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    };
  }, []);

  const setCounter = useCallback((c: Counter) => {
    setCounterState(c);
    saveCounter(c);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const jumpToEl = useCallback((el: HTMLElement) => {
    const w = wrapperRef.current;
    if (!el || !w) return;
    const state = w.state;
    const scale = state.scale;
    const elRect = el.getBoundingClientRect();
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const headerH = isMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT_DESKTOP;
    const targetLeft = 20;
    const targetTop = headerH + 16;
    const deltaX = targetLeft - elRect.left;
    const deltaY = targetTop - elRect.top;
    const next = clampCanvasPosition(state.positionX + deltaX, state.positionY + deltaY, scale);
    w.setTransform(next.x, next.y, scale, 500, "easeOutCubic");
  }, [clampCanvasPosition]);

  const jumpTo = useCallback((id: TabId) => {
    const el = document.getElementById(`sec-${id}`);
    if (el) jumpToEl(el);
  }, [jumpToEl]);

  useEffect(() => {
    if (matched && matched.size > 0) {
      const first = SECTIONS.find(s => matched.has(s.id));
      if (first) setTimeout(() => jumpTo(first.id), 60);
    }
  }, [query, matched, jumpTo]);

  // Deep-link: on load & on hashchange, jump to #card-xxx or #sec-xxx
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.slice(1);
      if (!h) return;
      const el = document.getElementById(h);
      if (el) setTimeout(() => jumpToEl(el), 80);
    };
    // wait a tick for canvas to mount
    setTimeout(handleHash, 200);
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [jumpToEl]);

  // Trackpad two-finger scroll → pan the canvas. Ctrl/Cmd/pinch → zoom (library handles).
  // Ignore wheel events originating inside a modal or scrollable UI element.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      // Let the browser handle wheel inside modals, scrollable inputs, etc.
      if (target && target.closest("[data-no-canvas-scroll], textarea, .isa-modal")) return;
      // Block browser page-zoom on Ctrl/Cmd+wheel — let the library zoom the canvas instead
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); return; }
      const w = wrapperRef.current;
      if (!w) return;
      e.preventDefault();
      const { positionX, positionY, scale } = w.state;
      const next = clampCanvasPosition(positionX - e.deltaX, positionY - e.deltaY, scale);
      w.setTransform(next.x, next.y, scale, 0);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clampCanvasPosition]);

  // Transform viewport sits BELOW the header — positions are viewport-relative
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const headerH = isMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT_DESKTOP;
  const initScale = 0.55;
  // Restore last-view (localStorage) or fall back to top-left
  const initialView = useMemo(() => {
    const fallback = { scale: initScale, x: 8 - CANVAS_PAD_LEFT * initScale, y: 8 - CANVAS_PAD_TOP * initScale };
    if (typeof localStorage === "undefined") return fallback;
    try {
      const raw = localStorage.getItem("isa:view");
      if (!raw) return fallback;
      const p = JSON.parse(raw) as { scale?: number; x?: number; y?: number };
      if (typeof p.scale === "number" && typeof p.x === "number" && typeof p.y === "number") {
        return { scale: p.scale, x: p.x, y: p.y };
      }
    } catch { /* ignore */ }
    return fallback;
  }, []);

  // Persist view (throttled) whenever the transform changes
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistView = useCallback((ref: ReactZoomPanPinchRef) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        const { scale, positionX, positionY } = ref.state;
        localStorage.setItem("isa:view", JSON.stringify({ scale, x: positionX, y: positionY }));
      } catch { /* ignore */ }
    }, 250);
  }, []);

  // Reset view = 100% zoom, first card pinned to top-left of viewport
  const resetView = useCallback(() => {
    const w = wrapperRef.current;
    if (!w) return;
    const scale = 1;
    const posY = 8 - CANVAS_PAD_TOP * scale;
    const posX = 8 - CANVAS_PAD_LEFT * scale;
    const next = clampCanvasPosition(posX, posY, scale);
    w.setTransform(next.x, next.y, scale, 350, "easeOutCubic");
  }, [clampCanvasPosition]);

  // Keyboard shortcuts: /, ?, R, Esc
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
      if (e.key === "r" || e.key === "R") { e.preventDefault(); resetView(); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen, notesOpen, query, resetView]);

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden bg-background">
      <TransformWrapper
        ref={wrapperRef}
        initialScale={initialView.scale}
        initialPositionX={initialView.x}
        initialPositionY={initialView.y}
        minScale={0.35}
        maxScale={2.5}
        limitToBounds={true}
        centerOnInit={false}
        centerZoomedOut={false}
        wheel={{ step: 0.06, activationKeys: ["Control", "Meta"], excluded: ["textarea", "input", "isa-modal"] }}
        pinch={{ excluded: ["textarea", "input", "isa-modal"] }}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: true, excluded: ["textarea", "input", "isa-modal"] }}
        onTransform={persistView}
      >
        <Header onJump={jumpTo} query={query} setQuery={setQuery} />
        <SectionRail onJump={jumpTo} />
        <TransformComponent wrapperStyle={{ position: "absolute", top: headerH, left: 0, right: 0, bottom: 0, width: "auto", height: "auto" }}>
          <Canvas matched={matched} query={deferredQuery} />
        </TransformComponent>
        <Toolbar dark={dark} setDark={setDark} onNotes={() => setNotesOpen(true)} counter={counter} setCounter={setCounter} onReset={resetView} onHelp={() => setHelpOpen(true)} />
      </TransformWrapper>
      <NotesModal open={notesOpen} onClose={() => setNotesOpen(false)} counter={counter} />
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
