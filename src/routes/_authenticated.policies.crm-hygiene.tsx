import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck, ArrowLeft, Info, AlertTriangle, AlertOctagon, ShieldAlert,
  ClipboardCheck, Clock, Users, ListChecks, CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/policies/crm-hygiene")({
  head: () => ({
    meta: [
      { title: "CRM Hygiene Guide — ISA Team" },
      { name: "description", content: "Standards for keeping Close CRM clean: what to log, when, and the consequence structure for non-compliance." },
    ],
  }),
  component: CrmHygiene,
});

const sections = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "standards", label: "Policy Standards", icon: ClipboardCheck },
  { id: "consequences", label: "Consequences", icon: ShieldAlert },
  { id: "implementation", label: "Implementation", icon: ListChecks },
];

function CrmHygiene() {
  const [active, setActive] = useState("overview");
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    Object.values(refs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-24">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to="/policies" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Policies
          </Link>
          <span>/</span>
          <span className="text-foreground">CRM Hygiene</span>
        </div>

        <header className="flex items-start gap-4 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">CRM Hygiene Guide</h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Close CRM is the source of truth for every conversation, booking, and outcome. Clean data = clean payouts, clean forecasts, and clean feedback loops.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Badge variant="outline">v1.0</Badge>
              <Badge variant="outline">Sales Team KPI</Badge>
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Sticky sub-nav */}
          <aside className="hidden lg:block">
            <nav className="sticky top-4 space-y-1">
              {sections.map((s) => {
                const isActive = active === s.id;
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
                    <s.icon className="h-4 w-4" />
                    {s.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="space-y-14 min-w-0">
            {/* OVERVIEW */}
            <section id="overview" ref={(el) => { refs.current.overview = el; }} className="scroll-mt-6">
              <SectionHeader icon={Info} kicker="01" title="Overview" />
              <p className="text-muted-foreground leading-relaxed">
                Every lead we touch — inbound, outbound, referral — lives in Close CRM. This isn't optional record-keeping. Your CRM is your paycheck, your feedback loop, and your promotion case all in one place. This guide defines the standard, the timing, and what happens if the standard slips.
              </p>

              <div className="grid sm:grid-cols-3 gap-3 mt-6">
                <MiniCard icon={ClipboardCheck} title="What to log" body="Every conversation, every stage change, every objection — no phantom leads." />
                <MiniCard icon={Clock} title="When to log it" body="Within the same working session. Never 'I'll catch up on Sunday'." />
                <MiniCard icon={Users} title="Who owns it" body="The setter who touched the lead. Handoffs are logged, not verbal." />
              </div>
            </section>

            {/* STANDARDS */}
            <section id="standards" ref={(el) => { refs.current.standards = el; }} className="scroll-mt-6">
              <SectionHeader icon={ClipboardCheck} kicker="02" title="Policy Standards" />
              <p className="text-muted-foreground leading-relaxed mb-6">
                Non-negotiables. If any of these aren't true at the end of your working day, you're non-compliant.
              </p>

              <div className="space-y-3">
                <Standard
                  n="01"
                  title="Every conversation logged same day"
                  body="If you had a DM, a call, or a story-reply exchange with a lead, it must be in Close before you sign off. No exceptions for 'busy days'."
                />
                <Standard
                  n="02"
                  title="Stage always reflects reality"
                  body="Lead statuses (New → Convo → Booked → Show → Close) must match the actual state of the conversation. A lead that went cold 3 weeks ago cannot still sit in 'Convo'."
                />
                <Standard
                  n="03"
                  title="Objection & constraint tags"
                  body="Every disqualified or delayed lead gets a reason tag: money / time / belief / deen / family. This drives our training and our follow-up SOPs."
                />
                <Standard
                  n="04"
                  title="Notes are searchable, not novels"
                  body="Notes use the format: [Objection] · [What they said in their words] · [Next action]. Screenshots and voice-notes are fine, but the structured line is required."
                />
                <Standard
                  n="05"
                  title="No duplicates, no phantom leads"
                  body="Search before you create. A lead you added but never actually spoke to is a phantom lead — delete it or mark it correctly. Phantom leads inflate metrics and are treated as data fraud."
                />
                <Standard
                  n="06"
                  title="Handoffs are written"
                  body="Passing a lead to a closer? Update the owner, add the handoff note, and tag the closer. 'I told him in Slack' is not a handoff."
                />
              </div>
            </section>

            {/* CONSEQUENCES */}
            <section id="consequences" ref={(el) => { refs.current.consequences = el; }} className="scroll-mt-6">
              <SectionHeader icon={ShieldAlert} kicker="03" title="Consequence Structure" />
              <p className="text-muted-foreground leading-relaxed">
                We believe in fairness and second chances. Consistent data hygiene, however, is non-negotiable.
              </p>

              <Card className="mt-6 p-5 border-l-4 border-l-primary bg-primary/5">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold">The Grace Period</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Each team member gets <span className="text-foreground font-medium">two (2) instances</span> of non-compliance per calendar month without penalty. Use them wisely — they reset on the 1st.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="mt-6 space-y-4">
                <ConsequenceStep
                  n={1}
                  tone="warning"
                  Icon={AlertTriangle}
                  headerLabel="1st & 2nd Instance"
                  badge="Warning"
                  title="Formal Written Warning"
                  body="Logged by your direct manager in your personnel file. Official notice to correct the behavior. No pay impact."
                />
                <ConsequenceStep
                  n={2}
                  tone="action"
                  Icon={AlertOctagon}
                  headerLabel="3rd Instance"
                  badge="Action Required"
                  title="Performance Improvement Plan (PIP)"
                  body="You're placed on a 30-day formal PIP with weekly CRM audits. A pattern of non-compliance is now on record. Bonuses paused until PIP is cleared."
                />
                <ConsequenceStep
                  n={3}
                  tone="critical"
                  Icon={ShieldAlert}
                  headerLabel="4th+ Instance"
                  badge="Critical"
                  title="Disciplinary Action"
                  body="Further action, which may include compensation adjustments, role change, or termination. Data fraud (phantom leads, backdated logs) skips straight to this tier."
                />
              </div>
            </section>

            {/* IMPLEMENTATION */}
            <section id="implementation" ref={(el) => { refs.current.implementation = el; }} className="scroll-mt-6">
              <SectionHeader icon={ListChecks} kicker="04" title="Implementation" />
              <p className="text-muted-foreground leading-relaxed mb-6">
                How this actually runs day-to-day.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <ImplCard
                  title="Daily"
                  items={[
                    "Log every conversation before signing off",
                    "Update lead stages as they change — not at end of week",
                    "Submit your EOD with the same numbers Close shows",
                  ]}
                />
                <ImplCard
                  title="Weekly (Sunday audit)"
                  items={[
                    "Manager runs a Close audit against your EODs",
                    "Any discrepancy > 5% = an instance logged",
                    "Team review of top objection tags in the Sunday call",
                  ]}
                />
                <ImplCard
                  title="Monthly"
                  items={[
                    "Instance counter resets on the 1st",
                    "Compliance score published on the team dashboard",
                    "Top 3 cleanest CRMs get first pick on new inbound leads",
                  ]}
                />
                <ImplCard
                  title="Escalation path"
                  items={[
                    "1st–2nd instance → direct manager",
                    "3rd instance → head of sales + PIP",
                    "4th+ → head of sales + founder",
                  ]}
                />
              </div>

              <Card className="mt-6 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold">Acknowledgement</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      By operating as a setter or closer on this team, you acknowledge this policy. Questions or edge cases go to your direct manager before the fact — not after.
                    </p>
                  </div>
                </div>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, kicker, title }: { icon: React.ComponentType<{ className?: string }>; kicker: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-xs text-muted-foreground">{kicker}</span>
      <div className="h-px flex-1 bg-border" />
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
    </div>
  );
}

function MiniCard({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <Card className="p-4">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
    </Card>
  );
}

function Standard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <Card className="p-4 flex gap-4">
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{n}</span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{body}</p>
      </div>
    </Card>
  );
}

function ConsequenceStep({
  n, Icon, headerLabel, badge, title, body, tone,
}: {
  n: number;
  Icon: React.ComponentType<{ className?: string }>;
  headerLabel: string;
  badge: string;
  title: string;
  body: string;
  tone: "warning" | "action" | "critical";
}) {
  const toneStyles = {
    warning: { border: "border-l-amber-500", ring: "ring-ring", badge: "bg-amber-500/15 text-amber-500 border-amber-500/30", num: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
    action: { border: "border-l-orange-500", ring: "ring-orange-500/40", badge: "bg-orange-500/15 text-orange-500 border-orange-500/30", num: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
    critical: { border: "border-l-red-500", ring: "ring-ring", badge: "bg-red-500/15 text-red-500 border-red-500/30", num: "bg-red-500/10 text-red-500 border-red-500/30" },
  }[tone];

  return (
    <div className="flex items-stretch gap-3">
      <div className={`h-10 w-10 shrink-0 rounded-full border flex items-center justify-center font-semibold ${toneStyles.num}`}>
        {n}
      </div>
      <Card className={`flex-1 p-5 border-l-4 ${toneStyles.border}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="font-semibold">{headerLabel}</p>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${toneStyles.badge}`}>
            {badge}
          </span>
        </div>
        <div className="flex items-start gap-2 pt-3 border-t border-border">
          <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">{title}</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{body}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ImplCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="p-5">
      <p className="font-semibold mb-3">{title}</p>
      <ul className="space-y-2 text-sm">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span className="text-muted-foreground">{it}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
