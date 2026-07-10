import { createFileRoute } from "@tanstack/react-router";
import { SECTIONS } from "@/data/sections";

export const Route = createFileRoute("/print")({
  head: () => ({
    meta: [
      { title: "ISA — Setter One-Pager (Print)" },
      { name: "description", content: "Print-ready single-column view of the ISA setter playbook" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Print,
});

function Print() {
  return (
    <div className="min-h-screen bg-white text-black">
      <style>{`
        @media print {
          @page { margin: 12mm; }
          .no-print { display: none !important; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
          body { background: white !important; }
        }
        .print-body :where(mark) { background: #fef08a; padding: 0 2px; border-radius: 2px; }
        .print-body button { display: none !important; }
        .print-body .script-block { background: #f6f6f2; border-left: 2px solid #999; padding: 6px 10px !important; margin: 4px 0; }
      `}</style>
      <div className="no-print sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">ISA Setter One-Pager</h1>
          <p className="text-xs text-neutral-500">Optimized for print / PDF. Hit ⌘/Ctrl+P.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-3 py-1.5 rounded bg-black text-white text-xs font-semibold">Print / Save PDF</button>
          <a href="/" className="px-3 py-1.5 rounded border border-neutral-300 text-xs font-semibold">← Back to canvas</a>
        </div>
      </div>
      <div className="print-body max-w-3xl mx-auto px-6 py-8 space-y-8">
        <header className="border-b border-neutral-300 pb-4">
          <h1 className="text-2xl font-black">Ivy Sales Academy — Setting Mastery</h1>
          <p className="text-sm text-neutral-600 mt-1">Complete system: conversation flows, scripts, objection handling, psychology, engagement & operations.</p>
        </header>
        {SECTIONS.map(section => (
          <section key={section.id} className="space-y-4">
            <h2 className="text-lg font-semibold uppercase tracking-wide border-l-4 pl-3" style={{ borderColor: section.color }}>{section.heading}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.cards.map((c, i) => (
                <article key={i} className="avoid-break border border-neutral-300 rounded p-4">
                  <div className="border-b border-neutral-200 pb-2 mb-2">
                    <h3 className="text-sm font-semibold">{c.title}</h3>
                    {c.subtitle && <p className="text-[11px] text-neutral-500 mt-0.5">{c.subtitle}</p>}
                  </div>
                  <div className="text-[12px] leading-relaxed">{c.body}</div>
                </article>
              ))}
            </div>
          </section>
        ))}
        <footer className="pt-4 border-t border-neutral-300 text-[10px] text-neutral-500">Generated from the Ivy Sales Academy canvas.</footer>
      </div>
    </div>
  );
}
