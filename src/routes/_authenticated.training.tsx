import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({ meta: [{ title: "Training — ISA Team" }] }),
  component: () => (
    <PhasePlaceholder
      title="Training Videos"
      phase="Phase 2"
      description="Your training library for the team."
      features={[
        "Upload videos organized by category and role",
        "Watch progress tracked per setter",
        "Assignments with completion status",
        "Comments and questions per video",
      ]}
    />
  ),
});
