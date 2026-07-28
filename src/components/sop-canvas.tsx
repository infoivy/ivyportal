import { type ReactNode, useState, isValidElement } from "react";
import { Copy, Check } from "lucide-react";

// Canvas-board primitives for SOP boards (DM Setting Mastery). Ported 1:1
// from the founder's Lovable build; only the shadow utilities are renamed
// (sop-shadow-*) to avoid clashing with the portal's --shadow-card token.

export type Cat =
  | "openers"
  | "qualifying"
  | "scripts"
  | "closing"
  | "objections"
  | "templates"
  | "psychology"
  | "engagement"
  | "tracking"
  | "frameworks";

export function Card({
  cat,
  width = 300,
  title,
  subtitle,
  children,
}: {
  cat: Cat;
  width?: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="bg-card rounded-xl border sop-shadow-card flex-shrink-0 overflow-hidden transition-all duration-150 hover:sop-shadow-elevated"
      style={{ width }}
    >
      <div className="h-1" style={{ backgroundColor: `hsl(var(--cat-${cat}))` }} />
      <div className="p-5">
        <h3 className="font-semibold text-sm mb-0.5 tracking-tight text-card-foreground">
          {title}
        </h3>
        {subtitle && <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>}
        <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Section({
  cat,
  title,
  children,
}: {
  cat: Cat;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-20">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: `hsl(var(--cat-${cat}))` }}
        />
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/70">
          {title}
        </h2>
      </div>
      <div className="flex gap-5 items-start flex-wrap">{children}</div>
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="font-medium text-card-foreground text-[11px] mb-1">{children}</p>;
}

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) return extractText((node.props as { children?: ReactNode }).children);
  return "";
}

export function Quote({ children, copy = true }: { children: ReactNode; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(extractText(children)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <div className="group relative bg-secondary/40 rounded pr-7">
      <p className="italic px-2 py-1.5 text-[11px] leading-snug">"{children}"</p>
      {copy && (
        <button
          type="button"
          onClick={onCopy}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Copy script"
          className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-background/70 transition-opacity"
        >
          {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
        </button>
      )}
    </div>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <p className="bg-secondary/40 px-2 py-1 rounded text-[10px]">{children}</p>
  );
}

export function Steps({
  cat,
  items,
}: {
  cat: Cat;
  items: { title: string; desc: string }[];
}) {
  return (
    <div className="space-y-0">
      {items.map((it, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="flex flex-col items-center">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-foreground/80 flex-shrink-0"
              style={{ backgroundColor: `hsl(var(--cat-${cat}))` }}
            >
              {i + 1}
            </div>
            {i < items.length - 1 && <div className="w-px h-6 bg-border" />}
          </div>
          <div className="pb-3">
            <p className="text-xs font-medium text-card-foreground">{it.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{it.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Tag({ cat, children }: { cat: Cat; children: ReactNode }) {
  return (
    <span
      className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-md text-foreground/90"
      style={{ backgroundColor: `hsl(var(--cat-${cat}))` }}
    >
      {children}
    </span>
  );
}

export function RouteChip({
  kind,
  children,
}: {
  kind: "green" | "amber" | "red" | "manager";
  children: ReactNode;
}) {
  const label = { green: "GREEN", amber: "AMBER", red: "RED", manager: "MANAGER REVIEW" }[kind];
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
      style={{
        backgroundColor: `hsl(var(--route-${kind}) / 0.15)`,
        color: `hsl(var(--route-${kind}))`,
      }}
    >
      {label} — {children}
    </span>
  );
}
