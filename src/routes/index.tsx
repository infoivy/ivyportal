import { createFileRoute } from "@tanstack/react-router";
import { TransformWrapper, TransformComponent, useControls, useTransformEffect, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { useRef, useState, useEffect, useCallback } from "react";
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

const SUGGESTIONS = ["objections", "budget", "halal", "hijrah", "mindset", "family", "outbound", "follow-up"];

const SEARCH_TAGS: Record<TabId, string[]> = {
  stages: ["stage", "process", "steps", "flow", "profile", "opener", "problem", "deep dive", "constraint", "routing", "recommendation", "close", "calendly", "dreamer", "stuck", "committed", "ready", "follow-up"],
  inbound: ["inbound", "path", "keyword", "reply", "permission close", "budget", "money", "invest", "halal", "haram"],
  outbound: ["outbound", "opener", "dm", "cold", "prospect", "targeting", "who to dm", "leads", "bad lead"],
  story: ["story", "reply", "engagement", "reaction", "posts", "instagram", "gym", "win", "struggle", "quote"],
  conv: ["conversation", "conv", "flow", "value drop", "youtube", "trust", "nurture", "warm", "brother", "self-identify", "follow-up"],
  dmclose: ["dm close", "close", "objection", "objections", "budget", "money", "financial", "price", "afford", "expensive", "cost", "time", "spouse", "wife", "family", "parents", "mindset", "fear", "faith", "religious", "haram", "halal", "burned", "scammed", "trust", "think about", "istikhara", "not ready", "deen"],
  psych: ["psychology", "principle", "mindset", "belief", "authority", "empathy", "emotion", "trust", "expect", "need"],
  engage: ["engagement", "engage", "story", "follow up", "follow-up", "nurture", "friend", "warm", "cold", "testimonial", "sunday", "pipeline", "proof", "student"],
  pacing: ["pacing", "ops", "operations", "schedule", "tracking", "crm", "targets", "kpi", "metrics", "daily", "sunday", "non-negotiable", "personality", "empathy phrases"],
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

function Toolbar({ dark, setDark, onNotes }: { dark: boolean; setDark: (v: boolean) => void; onNotes: () => void }) {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  const [pct, setPct] = useState(55);
  useTransformEffect(({ state }) => { setPct(Math.round(state.scale * 100)); });
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-background border border-border rounded-full shadow-lg px-2 py-1.5">
      <button onClick={() => zoomOut(0.15)} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center" title="Zoom out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
      </button>
      <span className="text-sm tabular-nums w-12 text-center">{pct}%</span>
      <button onClick={() => zoomIn(0.15)} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center" title="Zoom in">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <div className="w-px h-5 bg-border mx-1" />
      <button onClick={() => resetTransform()} className="h-8 px-3 rounded-full hover:bg-muted flex items-center gap-1.5 text-xs font-semibold" title="Reset view">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
        Reset
      </button>
      <div className="w-px h-5 bg-border mx-1" />
      <button onClick={onNotes} className="h-8 px-3 rounded-full hover:bg-muted flex items-center gap-1.5 text-xs font-semibold" title="Pre-call notes">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8l5-5z"/><path d="M9 3v5H4"/></svg>
        Notes
      </button>
      <button onClick={() => setDark(!dark)} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center" title={dark ? "Light mode" : "Dark mode"}>
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
          <img src={logoAsset.url} alt="Ivy Sales Academy" className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 object-contain" />
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
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search…"
            className="text-xs bg-card border border-border rounded-full pl-7 pr-3 py-1.5 w-32 sm:w-56 focus:outline-none focus:ring-2 focus:ring-[color:var(--tab-stages)]/30"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-2 sm:ml-12 overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onJump(t.id)}
            className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full whitespace-nowrap hover:opacity-90 transition-opacity shrink-0"
            style={{ backgroundColor: t.color }}
          >{t.label}</button>
        ))}
      </div>
      {!query && (
        <div className="hidden sm:flex gap-1.5 mt-1.5 ml-12 items-center">
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

function Card({ color, title, subtitle, children, matchQuery }: { color: string; title: string; subtitle?: string; children: React.ReactNode; matchQuery: string }) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [matches, setMatches] = useState(false);

  const copyAll = () => {
    const els = bodyRef.current?.querySelectorAll("[data-quote]");
    if (!els || !els.length) return;
    const txt = Array.from(els).map(e => (e as HTMLElement).innerText.trim()).join("\n\n");
    navigator.clipboard?.writeText(txt);
  };

  // Highlight matched words & detect card match
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    // remove old marks
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

  const hasScripts = /* set after render */ true;
  return (
    <div className={`w-[280px] bg-card rounded-lg shadow-sm border border-border overflow-hidden flex flex-col ${matches ? "card-matched" : ""}`}>
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="p-4 flex-1 relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-foreground leading-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {hasScripts && (
            <button onClick={copyAll} className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/70 bg-background/60" title="Copy all scripts in this card">
              Copy all
            </button>
          )}
        </div>
        <div ref={bodyRef} className="mt-3">{children}</div>
      </div>
    </div>
  );
}

function Canvas({ matched, query }: { matched: Set<TabId> | null; query: string }) {
  return (
    <div className="canvas-bg" style={{ width: 6400, minHeight: 4200, padding: "160px 40px 80px" }}>
      <div className="flex flex-col gap-8">
        {SECTIONS.map(section => {
          const dim = matched && !matched.has(section.id);
          return (
            <div
              key={section.id}
              style={{ opacity: dim ? 0.2 : 1, transition: "opacity 200ms" }}
            >
              <SectionHeading id={section.id} color={section.color} text={section.heading} />
              <div className="flex flex-wrap gap-4 items-start">
                {section.cards.map((c, i) => (
                  <Card key={i} color={section.color} title={c.title} subtitle={c.subtitle} matchQuery={query}>{c.body}</Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NotesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const defaultTpl = `PRE-CALL NOTES

Name / handle:
Age range:
Location:
Employment (job / student / in between):
Income / savings shared:
Hours available per week:
Family status (parents / wife aware):
Hijrah timeline:

LEAD TYPE (Dreamer / Stuck / Committed / Ready):
CURRENT STAGE (1–8):
PRIMARY CONSTRAINT (Money / Time / Belief):

Pain points (in his words):

Objections raised:

Proof sent:
Last interaction:
Next follow-up:

Call outcome:`;
  const [text, setText] = useState(defaultTpl);
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const copy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-foreground">Pre-Call Notes</h3>
            <p className="text-[11px] text-muted-foreground">Fill in the DM, copy to hand off to the closer.</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center text-muted-foreground" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          className="flex-1 min-h-[380px] p-3 text-xs font-mono bg-background text-foreground resize-none focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
          <button onClick={() => setText(defaultTpl)} className="text-xs text-muted-foreground hover:text-foreground">Reset template</button>
          <button onClick={copy} className="px-3 py-1.5 rounded-md bg-[color:var(--tab-stages)] text-white text-xs font-semibold hover:opacity-90">
            {copied ? "Copied!" : "Copy notes"}
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
  const [dark, setDark] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const matched = matchSections(query);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const jumpTo = useCallback((id: TabId) => {
    const el = document.getElementById(`sec-${id}`);
    const w = wrapperRef.current;
    if (!el || !w) return;
    const state = w.state;
    const scale = state.scale;
    const elRect = el.getBoundingClientRect();
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    const targetLeft = 20;
    const targetTop = (isMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT_DESKTOP) + 16;
    const deltaX = targetLeft - elRect.left;
    const deltaY = targetTop - elRect.top;
    w.setTransform(state.positionX + deltaX, state.positionY + deltaY, scale, 500, "easeOutCubic");
  }, []);

  useEffect(() => {
    if (matched && matched.size > 0) {
      const first = SECTIONS.find(s => matched.has(s.id));
      if (first) setTimeout(() => jumpTo(first.id), 60);
    }
  }, [query, matched, jumpTo]);

  // Trackpad two-finger scroll → pan the canvas. Ctrl/Cmd/pinch → zoom (library handles).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Browser emits ctrlKey=true on pinch-zoom gestures; let library handle those.
      if (e.ctrlKey || e.metaKey) return;
      const w = wrapperRef.current;
      if (!w) return;
      e.preventDefault();
      const { positionX, positionY, scale } = w.state;
      w.setTransform(positionX - e.deltaX, positionY - e.deltaY, scale, 0);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 overflow-hidden bg-background">
      <TransformWrapper
        ref={wrapperRef}
        initialScale={0.55}
        minScale={0.35}
        maxScale={2.5}
        limitToBounds={false}
        wheel={{ step: 0.06, activationKeys: ["Control", "Meta"] }}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: true }}
      >
        <Header onJump={jumpTo} query={query} setQuery={setQuery} />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <Canvas matched={matched} query={query} />
        </TransformComponent>
        <Toolbar dark={dark} setDark={setDark} onNotes={() => setNotesOpen(true)} />
      </TransformWrapper>
      <NotesModal open={notesOpen} onClose={() => setNotesOpen(false)} />
    </div>
  );
}
