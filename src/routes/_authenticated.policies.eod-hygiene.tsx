import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  FileText, ArrowLeft, Info, AlertTriangle, AlertOctagon, ShieldAlert,
  ClipboardCheck, Clock, Users, ListChecks, CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/policies/eod-hygiene")({
  head: () => ({
    meta: [
      { title: "EOD & Meetings Policy — ISA Team" },
      { name: "description", content: "The daily EOD standard for every role, meeting attendance rules, and the consequence structure for misses." },
    ],
  }),
  component: EodHygiene,
});

const sections = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "standards", label: "Policy Standards", icon: ClipboardCheck },
  { id: "consequences", label: "Consequences", icon: ShieldAlert },
  { id: "implementation", label: "Implementation", icon: ListChecks },
];

function EodHygiene() {
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
          <Link to="/knowledge" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Knowledge Hub
          </Link>
          <span>/</span>
          <span className="text-foreground">EOD &amp; Meetings Policy</span>
        </div>

        <header className="flex items-start gap-4 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <FileText className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">EOD &amp; Meetings Policy</h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              The EOD is the team's heartbeat. Every role files one, every single day — setters, closers, coaches, and CSMs. This page defines the standard, the timing, and what happens when it slips.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Badge variant="outline">v1.0</Badge>
              <Badge variant="outline">Every role</Badge>
              <Badge variant="outline">Zero-miss standard</Badge>
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
                Everything this team measures — compliance, funnels, payouts, at-risk students, your own streak — is built from EODs. One missing report doesn't just hide your day; it corrupts the team's picture of reality. That's why the standard is absolute: <span className="text-foreground font-medium">you do not miss an EOD. Ever.</span> The same applies to team meetings: if a meeting is on the calendar, you are in it.
              </p>

              <div className="grid sm:grid-cols-3 gap-3 mt-6">
                <MiniCard icon={ClipboardCheck} title="Who files" body="Everyone with a role: setters, closers, coaches, CSMs. No role is exempt, no seniority is exempt." />
                <MiniCard icon={Clock} title="When" body="Every day before 23:59 — seven days a week. There are no off days and no 'quiet days'. Zero is a valid answer." />
                <MiniCard icon={Users} title="Meetings" body="Team meetings are mandatory, on time, prepared. Absence needs founder approval BEFORE the meeting — not an apology after." />
              </div>
            </section>

            {/* STANDARDS */}
            <section id="standards" ref={(el) => { refs.current.standards = el; }} className="scroll-mt-6">
              <SectionHeader icon={ClipboardCheck} kicker="02" title="Policy Standards" />
              <p className="text-muted-foreground leading-relaxed mb-6">
                Non-negotiables. If any of these aren't true at the end of your day, you're non-compliant.
              </p>

              <div className="space-y-3">
                <Standard
                  n="01"
                  title="One EOD, every day, before 23:59"
                  body="Seven days a week. Sick, travelling, slow day — the report still goes in, even if every number is zero. The form autosaves a draft, works on your phone, and takes under three minutes. 'I forgot' is a miss."
                />
                <Standard
                  n="02"
                  title="Zero is a valid answer — silence is not"
                  body="A day with no dials is a data point. A day with no report is a hole. Submitting honest zeros is fully compliant; not submitting is the only way to fail this policy."
                />
                <Standard
                  n="03"
                  title="Numbers match reality"
                  body="Your EOD must agree with the CRM, the calendar, and the revenue log. Dials you didn't make, sets that don't exist in the calendar, or cash that isn't in the deal log are treated as data fraud — not as a miss."
                />
                <Standard
                  n="04"
                  title="Same-day only — no backfilling"
                  body="EODs are written the day they happen, while it's fresh. Backdated reports filed days later don't restore compliance; the miss already happened and the data is already suspect."
                />
                <Standard
                  n="05"
                  title="Wins and blockers are real sentences"
                  body="One or two honest lines. 'Good day' is not a win; 'nothing' is not a blocker if you rebooked three no-shows. This is where coaching and fixes come from — write it like your manager reads it, because they do."
                />
                <Standard
                  n="06"
                  title="Team meetings: present, on time, prepared"
                  body="A calendar invite is a commitment. Arrive on time with your numbers already submitted. If you genuinely cannot attend, get founder approval before the meeting starts and catch up on the recording the same day."
                />
              </div>
            </section>

            {/* CONSEQUENCES */}
            <section id="consequences" ref={(el) => { refs.current.consequences = el; }} className="scroll-mt-6">
              <SectionHeader icon={ShieldAlert} kicker="03" title="Consequence Structure" />
              <p className="text-muted-foreground leading-relaxed">
                This policy is stricter than CRM hygiene on purpose: there is <span className="text-foreground font-medium">no monthly grace allowance</span> for a silent miss. The only miss that doesn't count is one cleared with a founder <em>before</em> the deadline (genuine emergency, communicated in advance).
              </p>

              <Card className="mt-6 p-5 border-l-4 border-l-primary bg-primary/5">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold">The Emergency Exception</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Real life happens. If something serious prevents you from filing, message a founder <span className="text-foreground font-medium">before 23:59</span>. An approved exception is not a miss. An unapproved miss explained the next morning is still a miss.
                    </p>
                  </div>
                </div>
              </Card>

              <div className="mt-6 space-y-4">
                <ConsequenceStep
                  n={1}
                  tone="warning"
                  Icon={AlertTriangle}
                  headerLabel="1st Miss"
                  badge="Warning"
                  title="Formal Written Warning — same day"
                  body="Your manager logs it and you hear about it the next morning, not next week. The expectation is that this is the only one you ever collect."
                />
                <ConsequenceStep
                  n={2}
                  tone="action"
                  Icon={AlertOctagon}
                  headerLabel="2nd Miss (rolling 60 days)"
                  badge="Action Required"
                  title="Performance Improvement Plan (PIP)"
                  body="30-day formal PIP with daily check-ins on submission. Bonuses are paused until the PIP is cleared with a spotless streak."
                />
                <ConsequenceStep
                  n={3}
                  tone="critical"
                  Icon={ShieldAlert}
                  headerLabel="3rd Miss / Fabrication"
                  badge="Critical"
                  title="Disciplinary Action"
                  body="Compensation adjustment, role change, or termination. Fabricated numbers or backdated reports skip straight to this tier regardless of prior history."
                />
              </div>
            </section>

            {/* IMPLEMENTATION */}
            <section id="implementation" ref={(el) => { refs.current.implementation = el; }} className="scroll-mt-6">
              <SectionHeader icon={ListChecks} kicker="04" title="Implementation" />
              <p className="text-muted-foreground leading-relaxed mb-6">
                How this actually runs day-to-day — and how the portal makes it nearly impossible to miss by accident.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <ImplCard
                  title="Daily (you)"
                  items={[
                    "Submit on the EOD Reports page before 23:59 — phone works fine",
                    "The amber 'EOD due' pill in the top bar means you haven't filed yet today",
                    "The form autosaves a draft, so start it early and finish at night",
                    "Protect your streak — it's on the page for a reason",
                  ]}
                />
                <ImplCard
                  title="Daily (management)"
                  items={[
                    "Sales page shows who filed, who hit KPI, who is missing — live",
                    "'Missed yesterday' list is chased before 10:00 with the Copy-nudge button",
                    "Every miss is logged as an instance the same day",
                  ]}
                />
                <ImplCard
                  title="Weekly"
                  items={[
                    "Compliance and streaks reviewed in the team meeting",
                    "EOD numbers spot-checked against CRM and revenue (see CRM Hygiene)",
                    "Repeated Friday–Sunday softness gets called out — weekends count",
                  ]}
                />
                <ImplCard
                  title="Escalation path"
                  items={[
                    "1st miss → direct manager, same day",
                    "2nd miss → sales manager + PIP",
                    "3rd miss or fabrication → founders",
                  ]}
                />
              </div>

              <Card className="mt-6 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold">Acknowledgement</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      By holding any role on this team, you acknowledge this policy. Edge cases go to a founder before the deadline — not after. The report takes three minutes; the trust it builds takes months. Don't trade one for the other.
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
    warning: { border: "border-l-amber-500", badge: "bg-warning-bg text-warning-fg border-warning/25", num: "bg-warning-bg text-warning-fg border-warning/25" },
    action: { border: "border-l-orange-500", badge: "bg-warning-bg text-warning-fg border-warning/25", num: "bg-warning-bg text-warning-fg border-warning/25" },
    critical: { border: "border-l-red-500", badge: "bg-danger-bg text-danger-fg border-danger/25", num: "bg-danger-bg text-danger-fg border-danger/25" },
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
