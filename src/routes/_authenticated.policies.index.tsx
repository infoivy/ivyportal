import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowRight, Database } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/policies/")({
  head: () => ({ meta: [{ title: "Policies — ISA Team" }] }),
  component: PoliciesIndex,
});

const policies = [
  {
    slug: "crm-hygiene",
    title: "CRM Hygiene Guide",
    tag: "Data Quality",
    icon: Database,
    summary:
      "How every setter keeps Close CRM accurate: what to log, when to log it, and the consequence structure for non-compliance.",
    version: "v1.0",
  },
];

function PoliciesIndex() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
          <p className="text-sm text-muted-foreground">Team-wide standards. Read once, apply daily.</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {policies.map((p) => (
          <Link key={p.slug} to={"/policies/$slug" as never} params={{ slug: p.slug } as never}>
            <Card className="p-5 hover:border-primary/60 transition group h-full">
              <div className="flex items-start justify-between gap-3">
                <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                  <p.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2 py-0.5">
                  {p.tag}
                </span>
              </div>
              <div className="mt-4 space-y-1">
                <h2 className="text-base font-semibold group-hover:text-primary transition">{p.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.summary}</p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{p.version}</span>
                <span className="inline-flex items-center gap-1 text-primary">
                  Read <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
