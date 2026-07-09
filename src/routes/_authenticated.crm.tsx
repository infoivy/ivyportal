import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — ISA Team" }] }),
  component: () => (
    <PhasePlaceholder
      title="Close CRM"
      phase="Phase 3"
      description="Close CRM integration for leads, opportunities, and call outcomes."
      features={[
        "Admin adds Close API key in settings",
        "Live view of leads and opportunities",
        "Post call outcomes back to Close from EODs",
        "Pipeline value + activity feed",
      ]}
    />
  ),
});
