import { createFileRoute } from "@tanstack/react-router";
import { PhoneCall } from "lucide-react";
import raw from "@/data/sops/simple-discovery-framework-phone-setters.md?raw";
import { StyledSopPage, sectionsFromMarkdown } from "@/components/styled-sop";

// Content verbatim from the original doc (by Abu Bilal); presentation follows
// the EOD & Meetings Policy style (founder-directed 2026-07-29).
export const Route = createFileRoute("/_authenticated/sops/simple-discovery-framework")({
  head: () => ({ meta: [{ title: "Simple Discovery Framework · ISA" }] }),
  component: () => (
    <StyledSopPage
      icon={PhoneCall}
      title="Simple Discovery Framework"
      description="The phone-setter discovery call, step by step: opening, intent, situation, gap, and the handoff. By Abu Bilal."
      badges={["Setting", "Phone setters"]}
      sections={sectionsFromMarkdown(raw)}
    />
  ),
});
