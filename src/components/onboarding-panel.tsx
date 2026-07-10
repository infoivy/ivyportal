import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, GraduationCap, FileText, PlayCircle, ExternalLink, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  type OnboardingStep,
  type OnboardingTemplate,
  fetchTemplateForRole,
  fetchProgress,
  progressPercent,
  toggleStep,
} from "@/lib/onboarding";

const ROLE_ORDER = ["setter", "closer", "coach", "csm", "admin", "student"];

function pickRole(roles: string[]): string | null {
  for (const r of ROLE_ORDER) if (roles.includes(r)) return r;
  return roles[0] ?? null;
}

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  doc: FileText,
  video: PlayCircle,
  action: Sparkles,
  link: ExternalLink,
};

export function OnboardingPanel({ compact }: { compact?: boolean }) {
  const { user, roles } = useAuth();
  const [template, setTemplate] = useState<OnboardingTemplate | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  const role = pickRole(roles);

  useEffect(() => {
    if (!user || !role) return;
    let alive = true;
    (async () => {
      const [t, d] = await Promise.all([fetchTemplateForRole(role), fetchProgress(user.id, role)]);
      if (!alive) return;
      setTemplate(t);
      setDone(d);
    })();
    return () => { alive = false; };
  }, [user, role]);

  if (!user || !role || !template) return null;
  const pct = progressPercent(template.steps, done, role);
  if (pct === 100 && (compact || dismissed)) return null;

  const toggle = async (step: OnboardingStep) => {
    const key = `${role}:${step.id}`;
    const isDone = done.has(key);
    const next = new Set(done);
    if (isDone) next.delete(key); else next.add(key);
    setDone(next);
    await toggleStep(user.id, role, step.id, !isDone);
  };

  return (
    <div className="card-surface p-4 space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-primary/15 border border-primary/25">
            <GraduationCap className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{template.title}</h3>
            {template.description && !compact && <p className="text-[11px] text-muted-foreground truncate">{template.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-primary">{pct}%</div>
          {pct === 100 && !compact && (
            <button onClick={() => setDismissed(true)} className="text-[10px] text-muted-foreground hover:text-foreground">dismiss</button>
          )}
        </div>
      </div>
      <div className="h-1 rounded-full bg-[var(--accent)] overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1">
        {template.steps.map(step => {
          const isDone = done.has(`${role}:${step.id}`);
          const Icon = KIND_ICON[step.kind] ?? Sparkles;
          return (
            <li key={step.id} className="flex items-center gap-2 text-xs group">
              <button
                onClick={() => toggle(step)}
                className="shrink-0"
                title={isDone ? "Mark not done" : "Mark done"}
              >
                {isDone
                  ? <CheckCircle2 className="h-4 w-4 text-primary" />
                  : <Circle className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />}
              </button>
              <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
              <Link
                to={step.target as any}
                className={`flex-1 truncate ${isDone ? "line-through text-muted-foreground" : "hover:text-primary"}`}
              >{step.label}</Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
