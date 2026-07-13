import { useMemo } from "react";
import { ExternalLink, Rocket, MessageCircle, Construction, Play } from "lucide-react";
import {
  GROW_PLAYBOOKS,
  SURFACE_LABEL,
  type AppAction,
  type Playbook,
  type PlaybookSurface,
} from "@/data/growth-operator";

const SURFACE_ORDER: PlaybookSurface[] = ["live", "next", "hermes"];

const SURFACE_ICON = {
  live: Play,
  next: Construction,
  hermes: MessageCircle,
} as const;

export function GrowthPlaybooksPanel({
  onNavigate,
}: {
  /** Jump into Content views (weekly, hooks, …) */
  onNavigate?: (action: AppAction) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<PlaybookSurface, Playbook[]>();
    for (const s of SURFACE_ORDER) map.set(s, []);
    for (const p of GROW_PLAYBOOKS) {
      map.get(p.surface)?.push(p);
    }
    return map;
  }, []);

  return (
    <div className="space-y-5">
      <header className="rounded-xl border border-[var(--border)] bg-card px-4 py-3">
        <div className="flex items-start gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Not SOPs. Operating system.</h3>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-2xl">
              Grow doctrine is baked into how you work here. If it can be a calendar, checklist, queue, or
              scoreboard, it lives in the dashboard. If it’s judgment and craft, Hermes runs it with you in
              chat. Raw PDFs are last resort.
            </p>
          </div>
        </div>
      </header>

      {SURFACE_ORDER.map((surface) => {
        const list = grouped.get(surface) ?? [];
        if (!list.length) return null;
        const Icon = SURFACE_ICON[surface];
        return (
          <section key={surface} className="space-y-2">
            <div className="flex items-center gap-2 px-0.5">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {SURFACE_LABEL[surface]}
              </h4>
              <span className="text-[10px] text-muted-foreground/70">{list.length}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {list.map((p) => (
                <PlaybookCard key={p.id} playbook={p} onNavigate={onNavigate} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PlaybookCard({
  playbook: p,
  onNavigate,
}: {
  playbook: Playbook;
  onNavigate?: (action: AppAction) => void;
}) {
  const canJump = p.appAction !== "none" && p.appAction !== "seed" && onNavigate;

  return (
    <article className="rounded-xl border border-[var(--border)] bg-card px-3.5 py-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {p.phase} · {p.module}
          </div>
          <h5 className="text-[13px] font-semibold text-foreground mt-0.5">{p.title}</h5>
        </div>
        <SurfacePill surface={p.surface} />
      </div>
      <p className="text-[12px] text-muted-foreground leading-snug">{p.summary}</p>
      <p className="text-[12px] text-foreground/90 leading-snug border-l-2 border-primary/40 pl-2">
        <span className="text-muted-foreground">DFY: </span>
        {p.dfy}
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
        {canJump && (
          <button
            type="button"
            onClick={() => onNavigate?.(p.appAction)}
            className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90"
          >
            Open in dashboard
          </button>
        )}
        {p.externalUrl && (
          <a
            href={p.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[var(--border)] text-[11px] text-foreground hover:bg-muted"
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {p.surface === "hermes" && (
          <span className="text-[10px] text-muted-foreground">Say the title to Hermes in Telegram</span>
        )}
      </div>
    </article>
  );
}

function SurfacePill({ surface }: { surface: PlaybookSurface }) {
  const styles =
    surface === "live"
      ? "bg-success-bg text-success-fg border-success/25"
      : surface === "next"
        ? "bg-warning-bg text-warning-fg border-warning/25"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`shrink-0 text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${styles}`}>
      {surface}
    </span>
  );
}
