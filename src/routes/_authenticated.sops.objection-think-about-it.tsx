import { createFileRoute } from "@tanstack/react-router";
import { MessageCircleQuestion } from "lucide-react";
import raw from "@/data/sops/objection-think-about-it.md?raw";
import { StyledSopPage, sliceByMarkers } from "@/components/styled-sop";

// Content verbatim from the original transcript; presentation follows the
// EOD & Meetings Policy style (founder-directed 2026-07-29).
const SECTIONS = sliceByMarkers(raw, [
  { id: "opening", label: "Opening the Smokescreen", marker: "Think About it" },
  { id: "money", label: "Money", marker: "Money" },
  { id: "logistics", label: "Logistics", marker: "Logistics" },
  { id: "financing", label: "Financing", marker: "Financing" },
  { id: "fear", label: "Fear", marker: "Fear" },
  { id: "identity", label: "Identity", marker: "Identity" },
  { id: "partner", label: "Partner", marker: "Partner" },
  { id: "binaries", label: "Binaries", marker: "Binaries" },
  { id: "loop", label: "The Loop", marker: "Loop" },
  { id: "bridge", label: "Bridge & Reframes", marker: "Fear" },
  { id: "identity-deep", label: "Deeper Identity Work", marker: "Identity" },
  { id: "reverse", label: "Reverse & Fear of Failure", marker: "Reverse" },
]);

export const Route = createFileRoute("/_authenticated/sops/objection-think-about-it")({
  head: () => ({ meta: [{ title: "Objection · Think About It · ISA" }] }),
  component: () => (
    <StyledSopPage
      icon={MessageCircleQuestion}
      title="Objection · Think About It"
      description="The deep dive on the number-one smokescreen: what sits behind it (money, logistics, fear, identity, partner) and the exact language that opens each one."
      badges={["Closing", "Deep dive"]}
      sections={SECTIONS}
    />
  ),
});
