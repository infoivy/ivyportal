import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar — ISA Team" }] }),
  component: () => (
    <PhasePlaceholder
      title="Team Calendar"
      phase="Phase 2"
      description="Unified view of all closers' booked calls."
      features={[
        "Each closer connects their Google Calendar via OAuth",
        "Week/day view color-coded by closer",
        "Setters see availability before pitching a slot",
        "Filter by closer, call type, or setter",
      ]}
    />
  ),
});
