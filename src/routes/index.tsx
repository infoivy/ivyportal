import { createFileRoute } from "@tanstack/react-router";
import { TransformWrapper, TransformComponent, useControls, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
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

function Toolbar({ onPercent }: { onPercent: (p: number) => void }) {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  const [pct, setPct] = useState(55);
  useEffect(() => { onPercent(pct); }, [pct]);
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

const HEADER_HEIGHT = 128; // approx header pixel height

function Header({ onJump }: { onJump: (id: TabId) => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 px-6 py-3 bg-[#fcfbf8]/95 backdrop-blur-sm border-b border-border/60">
      <div className="flex items-center gap-3">
        <img src={logoAsset.url} alt="Ivy Sales Academy" className="w-9 h-9 flex-shrink-0 object-contain" />
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">Ivy Sales Academy</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Complete system: conversation flows, scripts, objection handling, psychology, engagement & operations</p>
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
  const wrapperRef = useRef<ReactZoomPanPinchRef | null>(null);

  const jumpTo = (id: TabId) => {
    const el = document.getElementById(`sec-${id}`);
    const w = wrapperRef.current;
    if (!el || !w) return;
    const scale = w.state.scale;
    // Position in canvas coordinates
    const canvas = el.closest(".canvas-bg") as HTMLElement | null;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // Element offset relative to canvas (in current scaled space)
    const offsetX = (elRect.left - canvasRect.left) / scale;
    const offsetY = (elRect.top - canvasRect.top) / scale;
    // Target: place element at x=24 (small left margin), y=HEADER_HEIGHT + 16
    const targetX = -offsetX * scale + 24;
    const targetY = -offsetY * scale + HEADER_HEIGHT + 16;
    w.setTransform(targetX, targetY, scale, 400, "easeOutCubic");
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
        {(utils) => (
          <>
            <Header onJump={jumpTo} />
            <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
              <Canvas />
            </TransformComponent>
            <Toolbar onPercent={() => {}} />
            <ScaleReadout />
            {/* keep utils referenced */}
            <span className="hidden">{utils.state.scale}</span>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}

function ScaleReadout() {
  return null;
}
