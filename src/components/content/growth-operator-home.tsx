import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { format, startOfWeek, parseISO, addDays } from "date-fns";
import {
  Rocket,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  Sparkles,
  BookOpen,
  Instagram,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  CHECKLIST_STORAGE_KEY,
  CONTENT_PLAN_URL,
  DOCTRINE_NOTE,
  FUNNEL_STAGE_CHECKS,
  GROW_EXAMPLES,
  GROW_PLAYBOOKS,
  type Playbook,
} from "@/data/growth-operator";
import { seedIvyDoctrineWeek } from "@/lib/growth-operator.functions";

function mondayYmd(d = new Date()): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function GrowthOperatorHome({
  onSeeded,
  onOpenPlaybooks,
  filledSlotCount,
  totalSlots = 7,
}: {
  onSeeded?: () => void;
  onOpenPlaybooks?: () => void;
  filledSlotCount?: number;
  totalSlots?: number;
}) {
  const seedFn = useServerFn(seedIvyDoctrineWeek);
  const [seeding, setSeeding] = useState(false);
  const [force, setForce] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [showDoneChecklist, setShowDoneChecklist] = useState(false);
  const weekStart = useMemo(() => mondayYmd(), []);
  const weekEnd = useMemo(() => format(addDays(parseISO(weekStart), 6), "MMM d"), [weekStart]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (raw) setChecks(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, []);

  const persistChecks = (next: Record<string, boolean>) => {
    setChecks(next);
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const toggleCheck = (id: string) => {
    const next = { ...checks, [id]: !checks[id] };
    persistChecks(next);
  };

  const doneCount = FUNNEL_STAGE_CHECKS.filter((c) => checks[c.id]).length;
  const allDone = doneCount === FUNNEL_STAGE_CHECKS.length;
  const openChecks = FUNNEL_STAGE_CHECKS.filter((c) => !checks[c.id]);
  const visibleChecks =
    allDone && !showDoneChecklist
      ? []
      : showDoneChecklist || !allDone
        ? FUNNEL_STAGE_CHECKS
        : openChecks;

  const emptySlots = Math.max(0, totalSlots - (filledSlotCount ?? 0));

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await seedFn({ data: { weekStart, force } });
      toast.success(
        `Week seeded (${res.updated} updated, ${res.inserted} inserted). Open Weekly plan.`,
      );
      onSeeded?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const playbooksByPhase = useMemo(() => {
    const map = new Map<string, Playbook[]>();
    for (const p of GROW_PLAYBOOKS.filter((x) => x.surface === "live")) {
      const list = map.get(p.phase) ?? [];
      list.push(p);
      map.set(p.phase, list);
    }
    return map;
  }, []);

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-[var(--border)] bg-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-muted/20">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="mt-0.5 h-8 w-8 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
              <Rocket className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-foreground tracking-tight">
                Growth Operator
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5 max-w-xl">
                DFY cockpit for the profile funnel. Doctrine from Grow Acquisition. This is your
                Content home — not a dead Google Drive.
              </p>
              <p className="text-[10px] text-muted-foreground/80 mt-1 font-mono">{DOCTRINE_NOTE}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="rounded border-border"
              />
              Overwrite idea slots
            </label>
            <button
              type="button"
              onClick={seed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-medium disabled:opacity-60"
            >
              {seeding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Seed this week ({format(parseISO(weekStart), "MMM d")}–{weekEnd})
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
          <Stat
            label="This week slots"
            value={`${filledSlotCount ?? "—"} / ${totalSlots}`}
            hint={emptySlots > 0 ? `${emptySlots} still empty or placeholder` : "Plan looks filled"}
            tone={emptySlots > 0 ? "warn" : "ok"}
          />
          <Stat
            label="Funnel stage focus"
            value="Content system"
            hint="Profile assets → weekly reels → DMs"
          />
          <Stat
            label="CTA / bio"
            value="DM PATH"
            hint="3–5K remote skill path · @abdulrahmankaderr"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {/* Stage checklist */}
        <div className="rounded-xl border border-[var(--border)] bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> Profile funnel checklist
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {doneCount}/{FUNNEL_STAGE_CHECKS.length}
            </span>
          </div>
          {allDone && !showDoneChecklist ? (
            <div className="rounded-lg border border-success/25 bg-success-bg/30 px-3 py-3 text-[12px] text-success-fg space-y-2">
              <p className="font-medium">Profile funnel checklist complete.</p>
              <p className="text-success-fg/80">
                Hidden so it doesn’t clutter the operator. Reopen anytime if something regresses.
              </p>
              <button
                type="button"
                onClick={() => setShowDoneChecklist(true)}
                className="text-[11px] underline underline-offset-2"
              >
                Show checklist again
              </button>
            </div>
          ) : (
            <>
              {allDone && (
                <button
                  type="button"
                  onClick={() => setShowDoneChecklist(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <ChevronDown className="h-3 w-3" /> Hide completed checklist
                </button>
              )}
              <ul className="space-y-2">
                {visibleChecks.map((c) => {
                  const done = !!checks[c.id];
                  return (
                    <li key={c.id} className="flex items-start gap-2 text-[13px]">
                      <button
                        type="button"
                        onClick={() => toggleCheck(c.id)}
                        className="mt-0.5 shrink-0"
                        aria-label={done ? "Mark incomplete" : "Mark complete"}
                      >
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-success-fg" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <div className={`min-w-0 ${done ? "opacity-50" : ""}`}>
                        <div
                          className={`text-foreground font-medium ${done ? "line-through" : ""}`}
                        >
                          {c.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{c.detail}</div>
                        {c.href && (
                          <a
                            href={c.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary mt-0.5 hover:underline"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Examples + quick playbooks */}
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--border)] bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Instagram className="h-3.5 w-3.5" /> Examples shelf
              </div>
              <span className="text-[10px] text-muted-foreground">GA student profiles</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GROW_EXAMPLES.map((ex) => (
                <a
                  key={ex.url + ex.label}
                  href={ex.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-[var(--border)] bg-muted/30 hover:bg-muted text-[11px] text-foreground"
                >
                  <span className="text-muted-foreground text-[9px] uppercase">{ex.kind}</span>
                  {ex.label}
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" /> Live in dashboard
              </div>
              {onOpenPlaybooks && (
                <button
                  type="button"
                  onClick={onOpenPlaybooks}
                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
                >
                  All playbooks <LayoutGrid className="h-3 w-3" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Full Grow list (live / next / Hermes) is under the Playbooks tab. Not a PDF library.
            </p>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {(["profile", "content", "conversations", "ads", "leadership"] as const).map(
                (phase) => {
                  const list = playbooksByPhase.get(phase) ?? [];
                  if (!list.length) return null;
                  return (
                    <div key={phase}>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        {phase}
                      </div>
                      <ul className="space-y-1">
                        {list.map((p) => (
                          <li
                            key={p.id}
                            className="rounded-lg border border-[var(--border)] px-2.5 py-2 hover:bg-muted/20"
                          >
                            <div className="text-[12px] font-medium text-foreground">{p.title}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{p.dfy}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                },
              )}
            </div>
            <a
              href={CONTENT_PLAN_URL}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              {CONTENT_PLAN_URL}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`text-[18px] font-semibold mt-0.5 ${
          tone === "warn"
            ? "text-warning-fg"
            : tone === "ok"
              ? "text-success-fg"
              : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}
