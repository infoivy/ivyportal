import { createFileRoute } from "@tanstack/react-router";
import { TransformWrapper, TransformComponent, useControls, useTransformEffect, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { useRef, useState, useEffect } from "react";
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

const HEADER_HEIGHT = 118;

// Keyword → section IDs. Search a word → matched sections light up, rest dim.
const SEARCH_TAGS: Record<TabId, string[]> = {
  stages: ["stage", "process", "steps", "flow", "profile", "opener", "problem", "deep dive", "constraint", "routing", "recommendation", "close", "calendly", "dreamer", "stuck", "committed", "ready"],
  inbound: ["inbound", "path", "keyword", "reply", "permission close", "budget", "money", "invest", "halal", "haram"],
  outbound: ["outbound", "opener", "dm", "cold", "prospect", "targeting", "who to dm", "leads", "bad lead"],
  story: ["story", "reply", "engagement", "reaction", "posts", "instagram", "gym", "win", "struggle", "quote"],
  conv: ["conversation", "conv", "flow", "value drop", "youtube", "trust", "nurture", "warm", "brother", "self-identify"],
  dmclose: ["dm close", "close", "objection", "objections", "budget", "money", "financial", "price", "afford", "expensive", "cost", "time", "spouse", "wife", "family", "parents", "mindset", "fear", "faith", "religious", "haram", "halal", "burned", "scammed", "trust", "think about", "istikhara", "not ready", "deen"],
  psych: ["psychology", "principle", "mindset", "belief", "authority", "empathy", "emotion", "trust", "expect", "need"],
  engage: ["engagement", "engage", "story", "follow up", "nurture", "friend", "warm", "cold", "testimonial", "sunday", "pipeline", "proof", "student"],
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

function Toolbar() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  const [pct, setPct] = useState(55);
  useTransformEffect(({ state }) => { setPct(Math.round(state.scale * 100)); });
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white border border-border rounded-full shadow-lg px-2 py-1.5">
      <button onClick={() => zoomIn(0.15)} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center" title="Zoom in">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      <span className="text-sm tabular-nums w-12 text-center">{pct}%</span>
      <button onClick={() => zoomOut(0.15)} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center" title="Zoom out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
      </button>
      <div className="w-px h-5 bg-border mx-1" />
      <button onClick={() => resetTransform()} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center" title="Fit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
      </button>
    </div>
  );
}

function Header({ onJump, query, setQuery }: { onJump: (id: TabId) => void; query: string; setQuery: (v: string) => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 px-6 py-3 bg-[#fcfbf8]/95 backdrop-blur-sm border-b border-border/60">
      <div className="flex items-center gap-3">
        <img src={logoAsset.url} alt="Ivy Sales Academy" className="w-9 h-9 flex-shrink-0 object-contain" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground leading-tight">Ivy Sales Academy</h1>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">Complete system: conversation flows, scripts, objection handling, psychology, engagement & operations</p>
        </div>
        <div className="relative flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search (e.g. budget, mindset, halal)…"
            className="text-xs bg-white border border-border rounded-full pl-7 pr-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-[color:var(--tab-stages)]/30"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2 ml-12">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onJump(t.id)}
            className="text-[11px] font-bold uppercase tracking-wide text-white px-3 py-1.5 rounded-full whitespace-nowrap hover:opacity-90 transition-opacity"
            style={{ backgroundColor: t.color }}
          >{t.label}</button>
        ))}
      </div>
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

function Card({ color, title, subtitle, children }: { color: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="w-[280px] bg-card rounded-lg shadow-sm border border-border overflow-hidden flex flex-col">
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="p-4 flex-1">
        <h3 className="text-[14px] font-bold text-foreground leading-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">{subtitle}</p>}
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function Canvas({ matched }: { matched: Set<TabId> | null }) {
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
                  <Card key={i} color={section.color} title={c.title} subtitle={c.subtitle}>{c.body}</Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Index() {
  const wrapperRef = useRef<ReactZoomPanPinchRef | null>(null);
  const [query, setQuery] = useState("");
  const matched = matchSections(query);

  const jumpTo = (id: TabId) => {
    const el = document.getElementById(`sec-${id}`);
    const w = wrapperRef.current;
    if (!el || !w) return;
    const state = w.state;
    const scale = state.scale;
    const elRect = el.getBoundingClientRect();
    // Place section heading at left edge (24px) so the leftmost card is fully visible,
    // and just below the fixed header.
    const targetLeft = 24;
    const targetTop = HEADER_HEIGHT + 20;
    const deltaX = targetLeft - elRect.left;
    const deltaY = targetTop - elRect.top;
    const newX = state.positionX + deltaX;
    const newY = state.positionY + deltaY;
    w.setTransform(newX, newY, scale, 500, "easeOutCubic");
  };

  // Auto-jump to first matched section on search
  useEffect(() => {
    if (matched && matched.size > 0) {
      const first = SECTIONS.find(s => matched.has(s.id));
      if (first) setTimeout(() => jumpTo(first.id), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#fcfbf8]">
      <TransformWrapper
        ref={wrapperRef}
        initialScale={0.55}
        minScale={0.45}
        maxScale={2.5}
        limitToBounds={false}
        wheel={{ step: 0.03 }}
        pinch={{ step: 2 }}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: true }}
      >
        <Header onJump={jumpTo} query={query} setQuery={setQuery} />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <Canvas matched={matched} />
        </TransformComponent>
        <Toolbar />
      </TransformWrapper>
    </div>
  );
}
