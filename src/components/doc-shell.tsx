import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export type DocSection = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

/**
 * The document layout extracted from the CRM Hygiene guide — breadcrumb,
 * hero (icon box + title + description + badges), and a sticky section nav
 * beside the content. Section elements inside `children` must carry matching
 * ids and `scroll-mt-6`.
 */
export function DocShell({
  breadcrumb,
  icon: Icon,
  title,
  description,
  badges = [],
  sections,
  actions,
  children,
}: {
  breadcrumb: { to: string; label: string; current: string };
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  badges?: string[];
  sections: DocSection[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [sections]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-full">
      <div className="w-full max-w-none px-4 sm:px-6 pt-6 pb-24">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to={breadcrumb.to} className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {breadcrumb.label}
          </Link>
          <span>/</span>
          <span className="text-foreground truncate">{breadcrumb.current}</span>
        </div>

        <header className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-start gap-4 min-w-0">
            <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
              {description && (
                <p className="mt-2 text-muted-foreground max-w-2xl">{description}</p>
              )}
              {badges.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
                  {badges.map((b) => (
                    <Badge key={b} variant="outline">{b}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>

        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav className="sticky top-4 space-y-1">
              {sections.map((s) => {
                const isActive = active === s.id;
                const SIcon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                      isActive
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {SIcon && <SIcon className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="space-y-14 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Kicker number + rule + icon + title — the section heading treatment. */
export function DocSectionHeader({
  icon: Icon,
  kicker,
  title,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  kicker: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-xs text-muted-foreground">{kicker}</span>
      <div className="h-px flex-1 bg-border" />
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
    </div>
  );
}

/** Left-border callout card. */
export function DocCallout({
  icon: Icon,
  title,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="mt-6 p-5 border-l-4 border-l-primary bg-primary/5">
      <div className="flex items-start gap-3">
        {Icon && <Icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />}
        <div>
          <p className="font-semibold">{title}</p>
          {children && <div className="text-sm text-muted-foreground mt-1">{children}</div>}
        </div>
      </div>
    </Card>
  );
}
