import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — ISA Team" }] }),
  component: () => (
    <PhasePlaceholder
      title="Analytics"
      phase="Phase 3"
      description="Team and individual performance dashboards."
      features={[
        "Daily / weekly / monthly rollups from EOD data",
        "Conversion funnel: DMs → convos → booked → shows → closes",
        "Leaderboard by setter",
        "Trend charts and week-over-week deltas",
      ]}
    />
  ),
});
