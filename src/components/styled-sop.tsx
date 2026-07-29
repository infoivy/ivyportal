import type { LucideIcon } from "lucide-react";
import { Navigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { DocShell, DocSectionHeader } from "@/components/doc-shell";
import { useAuth } from "@/lib/auth-context";
import { MarkdownView } from "@/components/markdown-view";

/**
 * The professional SOP treatment (founder 2026-07-29: every SOP in the EOD &
 * Meetings Policy style). Content stays VERBATIM from the source doc; this
 * component only supplies the shell (sticky section nav, kicker headers) and
 * a transcript-aware formatter that turns raw script lines into tiles:
 * prospect lines, numbered steps, sub-headers, coaching notes.
 */

export type SopSection = {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Raw text of this section (markdown or plain transcript). */
  body: string;
  /** "md" renders through MarkdownView; "script" uses the transcript formatter. */
  render: "md" | "script";
};

/** Split a raw doc at exact marker lines (first occurrence each, in order). */
export function sliceByMarkers(raw: string, markers: { id: string; label: string; marker: string; icon?: LucideIcon }[]): SopSection[] {
  const lines = raw.split("\n");
  const starts: { idx: number; m: (typeof markers)[number] }[] = [];
  let cursor = 0;
  for (const m of markers) {
    for (let i = cursor; i < lines.length; i++) {
      if (lines[i].trim() === m.marker.trim()) {
        starts.push({ idx: i, m });
        cursor = i + 1;
        break;
      }
    }
  }
  return starts.map((s, i) => ({
    id: s.m.id,
    label: s.m.label,
    icon: s.m.icon,
    render: "script" as const,
    body: lines.slice(s.idx + 1, i + 1 < starts.length ? starts[i + 1].idx : lines.length).join("\n"),
  }));
}

const CAPSY = /^[A-Z][A-Z0-9 /&'’.-]{3,}$/;

/** One transcript block → styled tiles. Content untouched, only presentation. */
function ScriptBody({ body }: { body: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = body.split("\n");
  let para: string[] = [];
  let key = 0;

  const flush = () => {
    const text = para.join(" ").trim();
    para = [];
    if (!text) return;
    blocks.push(
      <p key={key++} className="text-[15px] leading-7 text-foreground/90">
        {text}
      </p>,
    );
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flush(); continue; }

    if (line.startsWith("→")) {
      flush();
      blocks.push(
        <Card key={key++} className="border-l-4 border-l-warning bg-warning-bg/60 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-warning-fg mb-1">Prospect</div>
          <div className="text-[15px] leading-6 text-foreground">{line.replace(/^→\s*/, "")}</div>
        </Card>,
      );
      continue;
    }

    const step = line.match(/^Step\s+(\d+)\s*[:.]?\s*(.*)$/i);
    if (step) {
      flush();
      blocks.push(
        <div key={key++} className="flex items-start gap-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary text-sm font-semibold">{step[1]}</span>
          <Card className="flex-1 px-4 py-3 text-[15px] leading-7">{step[2]}</Card>
        </div>,
      );
      continue;
    }

    if (line === "OR") {
      flush();
      blocks.push(
        <div key={key++} className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>,
      );
      continue;
    }

    if (CAPSY.test(line) || (/^[A-Z][a-z].{0,28}$/.test(line) && !line.endsWith(".") && !line.endsWith("…") && line.split(" ").length <= 4)) {
      flush();
      blocks.push(
        <h3 key={key++} className="pt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">
          {line}
        </h3>,
      );
      continue;
    }

    if (/^\(?(if|when|note|wait|pause|only|use|do not|don'?t)\b/i.test(line) && (line.startsWith("(") || /^(If|When|Note|Wait|Only)\b/.test(line))) {
      flush();
      blocks.push(
        <p key={key++} className="border-l-2 border-border pl-3 text-[13px] leading-6 italic text-muted-foreground">
          {line}
        </p>,
      );
      continue;
    }

    para.push(line);
  }
  flush();
  return <div className="space-y-3">{blocks}</div>;
}

export function StyledSopPage({ icon, title, description, badges, sections }: {
  icon: LucideIcon;
  title: string;
  description: string;
  badges: string[];
  sections: SopSection[];
}) {
  const { roles } = useAuth();
  if (roles.length > 0 && roles.every(r => r === "student")) return <Navigate to="/knowledge" replace />;
  return (
    <DocShell
      breadcrumb={{ to: "/knowledge", label: "Knowledge Hub", current: title }}
      icon={icon}
      title={title}
      description={description}
      badges={badges}
      sections={sections.map(s => ({ id: s.id, label: s.label, icon: s.icon }))}
    >
      {sections.map((s, i) => (
        <section key={s.id} id={s.id} className="scroll-mt-6">
          <DocSectionHeader icon={s.icon} kicker={String(i + 1).padStart(2, "0")} title={s.label} />
          <div className="mt-5">
            {s.render === "md" ? <MarkdownView content={s.body} /> : <ScriptBody body={s.body} />}
          </div>
        </section>
      ))}
    </DocShell>
  );
}

/** Markdown docs with real ## headings split themselves. */
export function sectionsFromMarkdown(raw: string): SopSection[] {
  const parts = raw.split(/\n(?=## )/);
  const out: SopSection[] = [];
  for (const part of parts) {
    const m = part.match(/^## (.+)\n?/);
    if (!m) continue; // intro before the first ## folds into the description
    const label = m[1].trim();
    out.push({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      label,
      render: "md",
      body: part.slice(m[0].length),
    });
  }
  return out;
}
