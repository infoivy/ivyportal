import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SECTIONS } from "@/data/sections";
import { TABS } from "@/data/content";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setting-process")({
  head: () => ({
    meta: [
      { title: "Setting Process — Ivy Portal" },
      { name: "description", content: "The 8-Stage Setting Process, scripts, objections, psychology and ops." },
    ],
  }),
  component: SettingProcessPage,
});

function SettingProcessPage() {
  const [active, setActive] = useState<string>(SECTIONS[0]?.id ?? "stages");
  const section = SECTIONS.find(s => s.id === active) ?? SECTIONS[0];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Setting Mastery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            The complete setter playbook — conversation flows, scripts, objections, psychology & ops.
          </p>
        </div>
        <a
          href="/print"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
        >
          <Printer className="h-3.5 w-3.5" /> Print / PDF
        </a>
      </header>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-2 -mx-1 px-1 overflow-x-auto">
        {TABS.map(t => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={
                "text-[12px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-md border transition-colors whitespace-nowrap " +
                (isActive
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-foreground/70 border-border hover:text-foreground hover:bg-muted")
              }
              style={isActive ? { backgroundColor: t.color, borderColor: t.color, color: "#fff" } : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {section && (
        <section className="space-y-4">
          <h2
            className="text-lg md:text-xl font-bold uppercase tracking-wide border-l-4 pl-3"
            style={{ borderColor: section.color }}
          >
            {section.heading}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {section.cards.map((c, i) => (
              <article
                key={i}
                className="rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="border-b border-border/60 pb-2 mb-3">
                  <h3 className="text-sm font-bold text-foreground">{c.title}</h3>
                  {c.subtitle && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{c.subtitle}</p>
                  )}
                </div>
                <div className="text-[13px] leading-relaxed">{c.body}</div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
