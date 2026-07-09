import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { BookOpen, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sops")({
  head: () => ({ meta: [{ title: "SOPs — ISA Team" }] }),
  component: SOPsLayout,
});

const SOPS = [
  {
    slug: "isa-setting-process",
    title: "ISA Setting Process",
    description: "The full 8-stage setting system: openers, conversation flow, objection handling, follow-ups, psychology, engagement, and ops.",
    role: "Setters",
  },
];

function SOPsLayout() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const isIndex = pathname === "/sops" || pathname === "/sops/";

  if (!isIndex) return <Outlet />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Standard Operating Procedures</h1>
        <p className="text-muted-foreground mt-1">Playbooks and process documents for the team.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SOPS.map(sop => (
          <Link key={sop.slug} to={`/sops/${sop.slug}` as any}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{sop.title}</CardTitle>
                    <CardDescription className="mt-1">{sop.description}</CardDescription>
                    <div className="flex items-center justify-between mt-3 text-xs">
                      <span className="text-muted-foreground">For: {sop.role}</span>
                      <span className="text-primary flex items-center gap-1">Open <ArrowRight className="h-3 w-3" /></span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        <Card className="border-dashed">
          <CardContent className="p-5 flex items-center justify-center text-sm text-muted-foreground min-h-[120px]">
            More SOPs coming — closer playbook, onboarding, KPI standards.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
