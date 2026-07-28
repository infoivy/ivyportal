import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import type { PortalNavItem } from "@/lib/portal-navigation";

export function WorkspaceDirectory({
  eyebrow,
  title,
  subtitle,
  items,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: readonly PortalNavItem[];
}) {
  return (
    <PageShell className="pb-24 sm:pb-6">
      <div className="pt-2">
        <div className="text-micro font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
          {eyebrow}
        </div>
        <PageHeader title={title} subtitle={subtitle} />
      </div>

      <section className="card-surface overflow-hidden" aria-label={`${title} tools`}>
        {items.length ? (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <Link
                key={item.key}
                to={item.url as never}
                preload="intent"
                className="group grid min-h-[76px] grid-cols-[40px_minmax(0,1fr)_32px] items-center gap-3 px-4 py-3.5 hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-safe:transition-colors sm:min-h-[82px] sm:px-5"
              >
                <span className="grid h-10 w-10 place-items-center rounded-md bg-muted text-muted-foreground group-hover:text-foreground motion-safe:transition-colors">
                  <item.icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-body font-semibold text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-caption leading-5 text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <span className="grid h-8 w-8 place-items-center text-muted-foreground group-hover:text-foreground motion-safe:transition-colors">
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-body font-medium text-foreground">
              No tools are assigned to this role.
            </p>
            <p className="mt-1 text-caption text-muted-foreground">
              Ask an admin if your access should be updated.
            </p>
          </div>
        )}
      </section>

      <p className="px-1 text-caption text-muted-foreground">
        Only workspaces available to your current roles are shown.
      </p>
    </PageShell>
  );
}
