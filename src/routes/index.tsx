import { createFileRoute } from "@tanstack/react-router";
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";
import { useState } from "react";
import { TABS, type TabId } from "@/data/content";
import { SECTIONS } from "@/data/sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Grow Acquisition — Setting Mastery" },
      { name: "description", content: "Complete system: conversation flows, scripts, objection handling, psychology, engagement & operations" },
    ],
  }),
  component: Index,
});

function Toolbar() {
  const { zoomIn, zoomOut, resetTransform, instance } = useControls();
  const [pct, setPct] = useState(55);
  // update percentage on transform
  if (instance?.transformState) {
    const s = Math.round(instance.transformState.scale * 100);
    if (s !== pct) setTimeout(() => setPct(s), 0);
  }
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white border border-border rounded-full shadow-lg px-2 py-1.5">
      <button className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center" title="Select">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7 17 2-7 7-2z"/></svg>
      </button>
      <button className="w-8 h-8 rounded-full bg-muted flex items-center justify-center" title="Pan">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 13V5a2 2 0 114 0v6M12 11V3a2 2 0 114 0v8M16 11V5a2 2 0 114 0v10a6 6 0 01-6 6h-2c-3 0-4-1-6-5l-2-4c-1-2 1-3 2-2l2 3"/></svg>
      </button>
      <div className="w-px h-5 bg-border mx-1" />
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

function Header() {
  return (
    <div className="absolute top-0 left-0 right-0 z-40 px-8 py-6 pointer-events-none">
      <div className="flex items-start gap-3 pointer-events-auto">
        <div className="w-8 h-8 rounded-full bg-[color:var(--tab-stages)] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">G</div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Grow Acquisition — Setting Mastery</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Complete system: conversation flows, scripts, objection handling, psychology, engagement & operations</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 ml-11 pointer-events-auto">
        {TABS.map(t => (
          <a key={t.id} href={`#sec-${t.id}`} className="text-[11px] font-bold uppercase tracking-wide text-white px-3 py-1.5 rounded-full whitespace-nowrap"
            style={{ backgroundColor: t.color }}>{t.label}</a>
        ))}
      </div>
    </div>
  );
}

function SectionHeading({ id, color, text }: { id: TabId; color: string; text: string }) {
  return (
    <div id={`sec-${id}`} className="col-span-full flex items-center gap-2 mt-6 mb-2">
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

function Canvas() {
  return (
    <div className="canvas-bg" style={{ width: 6400, minHeight: 4200, padding: "160px 40px 80px" }}>
      <div className="flex flex-col gap-8">
        {SECTIONS.map(section => (
          <div key={section.id}>
            <SectionHeading id={section.id} color={section.color} text={section.heading} />
            <div className="flex flex-wrap gap-4 items-start">
              {section.cards.map((c, i) => (
                <Card key={i} color={section.color} title={c.title} subtitle={c.subtitle}>{c.body}</Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Index() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#fcfbf8]">
      <TransformWrapper
        initialScale={0.55}
        minScale={0.2}
        maxScale={2}
        limitToBounds={false}
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: true }}
        panning={{ velocityDisabled: true }}
      >
        <Header />
        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
          <Canvas />
        </TransformComponent>
        <Toolbar />
      </TransformWrapper>
    </div>
  );
}
