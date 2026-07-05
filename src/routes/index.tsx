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

// Keyword → section IDs. Search a word → sections whose tags include it become the match set.
const SEARCH_TAGS: Record<TabId, string[]> = {
  stages: ["stage", "process", "steps", "flow", "profile research", "opener", "problem", "deep dive", "constraint", "routing", "recommendation", "close", "calendly"],
  inbound: ["inbound", "info", "keyword", "reply", "permission close", "budget", "money", "finance", "financial", "invest", "price", "afford"],
  outbound: ["outbound", "opener", "dm", "cold", "prospect", "targeting", "who to dm", "leads"],
  story: ["story", "story reply", "reply", "engagement", "reaction", "posts", "instagram"],
  conv: ["conversation", "conv", "flow", "value drop", "youtube", "trust", "nurture", "warm"],
  dmclose: ["dm close", "close", "pricing", "price", "payment", "offer", "commitment", "buy"],
  objections: ["objection", "objections", "budget", "money", "financial", "finance", "price", "afford", "expensive", "cost", "time", "spouse", "wife", "family", "parents", "mindset", "fear", "faith", "religious", "haram", "halal", "burned", "trust", "think about", "not ready", "followers", "someone else"],
  psych: ["psychology", "principle", "mindset", "belief", "authority", "empathy", "emotion", "trust"],
  engage: ["engagement", "engage", "story", "follow up", "nurture", "friend", "warm", "cold", "testimonial", "sunday", "pipeline"],
  lang: ["language", "tone", "words", "phrases", "voice", "sound"],
  frame: ["framework", "positioning", "structure", "template"],
  pacing: ["pacing", "ops", "operations", "schedule", "tracking", "crm", "targets", "kpi", "metrics", "daily", "sunday", "non-negotiable"],
};

function matchSections(query: string): Set<TabId> | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const matched = new Set<TabId>();
  for (const s of SECTIONS) {
    const tags = SEARCH_TAGS[s.id] || [];
    const hay = [s.heading.toLowerCase(), ...tags].join(" | ");
    if (hay.includes(q)) matched.add(s.id);
    // also match individual card titles/subtitles
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
            placeholder="Search (e.g. budget, mindset)…"
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

// Minimap: shows the whole canvas + a viewport rectangle. Click to jump.
const MINI_W = 200;
const MINI_H = 132;
const CANVAS_W = 6400;
const CANVAS_H = 4200;

function Minimap({ wrapperRef }: { wrapperRef: React.MutableRefObject<ReactZoomPanPinchRef | null> }) {
  const [tick, setTick] = useState(0);
  useTransformEffect(() => { setTick(t => t + 1); });
  const w = wrapperRef.current;
  const state = w?.state;
  const scale = state?.scale || 0.55;
  const posX = state?.positionX || 0;
  const posY = state?.positionY || 0;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // Visible portion of canvas in canvas coords:
  const visX = -posX / scale;
  const visY = -posY / scale;
  const visW = vw / scale;
  const visH = vh / scale;

  const sx = MINI_W / CANVAS_W;
  const sy = MINI_H / CANVAS_H;

  const jumpFromMini = (mx: number, my: number) => {
    const w2 = wrapperRef.current;
    if (!w2) return;
    // canvas point clicked:
    const cx = mx / sx;
    const cy = my / sy;
    // center that point on screen
    const targetX = -cx * scale + vw / 2;
    const targetY = -cy * scale + vh / 2;
    w2.setTransform(targetX, targetY, scale, 400, "easeOutCubic");
  };

  void tick;
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white/95 border border-border rounded-md shadow-lg p-1.5 backdrop-blur-sm">
      <div
        className="relative overflow-hidden rounded cursor-crosshair"
        style={{ width: MINI_W, height: MINI_H, backgroundColor: "#fcfbf8" }}
        onClick={(e) => {
          const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          jumpFromMini(e.clientX - r.left, e.clientY - r.top);
        }}
      >
        {/* section markers */}
        {SECTIONS.map((s, i) => {
          const el = typeof document !== "undefined" ? document.getElementById(`sec-${s.id}`) : null;
          const canvas = el?.closest(".canvas-bg") as HTMLElement | null;
          if (!el || !canvas) return null;
          const canvasRect = canvas.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const y = (elRect.top - canvasRect.top) / scale;
          return (
            <div
              key={s.id}
              style={{
                position: "absolute",
                left: 4,
                top: y * sy,
                right: 4,
                height: 2,
                backgroundColor: s.color,
                opacity: 0.5,
              }}
              title={s.heading}
            >
              <div style={{ position: "absolute", left: -2, top: -2, width: 6, height: 6, borderRadius: 3, backgroundColor: s.color }} />
              {void i}
            </div>
          );
        })}
        {/* viewport rect */}
        <div
          style={{
            position: "absolute",
            left: Math.max(0, visX * sx),
            top: Math.max(0, visY * sy),
            width: Math.min(MINI_W, visW * sx),
            height: Math.min(MINI_H, visH * sy),
            border: "2px solid #0d6b5b",
            backgroundColor: "rgba(13,107,91,0.08)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

function Index() {
  const wrapperRef = useRef<ReactZoomPanPinchRef | null>(null);
  const [query, setQuery] = useState("");
  const matched = matchSections(query);

  // When search matches, auto-jump to first matched section
  useEffect(() => {
    if (matched && matched.size > 0) {
      const first = SECTIONS.find(s => matched.has(s.id));
      if (first) {
        // small delay to let opacity settle
        setTimeout(() => jumpTo(first.id), 50);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const jumpTo = (id: TabId) => {
    const el = document.getElementById(`sec-${id}`);
    const w = wrapperRef.current;
    if (!el || !w) return;
    const state = w.state;
    const scale = state.scale;
    const elRect = el.getBoundingClientRect();
    // We want elRect.left → 24, elRect.top → HEADER_HEIGHT + 16
    // Delta on screen equals delta on positionX/Y (transform is translate then scale)
    const deltaX = 24 - elRect.left;
    const deltaY = (HEADER_HEIGHT + 16) - elRect.top;
    const newX = state.positionX + deltaX;
    const newY = state.positionY + deltaY;
    w.setTransform(newX, newY, scale, 500, "easeOutCubic");
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#fcfbf8]">
      <TransformWrapper
        ref={wrapperRef}
        initialScale={0.55}
        minScale={0.45}
        maxScale={2.5}
        limitToBounds={false}
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: true }}
      >
        <Header onJump={jumpTo} query={query} setQuery={setQuery} />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <Canvas matched={matched} />
        </TransformComponent>
        <Toolbar />
        <Minimap wrapperRef={wrapperRef} />
      </TransformWrapper>
    </div>
  );
}
