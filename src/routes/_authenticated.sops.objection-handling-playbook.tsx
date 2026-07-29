import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import raw from "@/data/sops/objection-handling-playbook.md?raw";
import { StyledSopPage, sliceByMarkers } from "@/components/styled-sop";

// Content verbatim from the original transcript; presentation follows the
// EOD & Meetings Policy style (founder-directed 2026-07-29).
const SECTIONS = sliceByMarkers(raw, [
  { id: "think-about-it", label: "Think About It", marker: "THINK ABOUT IT" },
  { id: "partner", label: "Partner", marker: "PARTNER" },
  { id: "money-logistics-quick", label: "Money & Logistics · quick answers", marker: "MONEY" },
  { id: "partner-tie-down", label: "Partner Tie-Down", marker: "PARTNER TIE DOWN" },
  { id: "responsibility-close", label: "Responsibility Close", marker: "RESPONSIBILITY CLOSE" },
  { id: "partner-logistics", label: "Partner / Logistics", marker: "PARTNER / LOGISTICS" },
  { id: "money", label: "Money", marker: "MONEY" },
  { id: "fear-clarification", label: "Fear & Clarification", marker: "FEAR" },
  { id: "bridge-frame", label: "Bridge Frame", marker: "BRIDGE FRAME" },
  { id: "logistics", label: "Logistics", marker: "LOGISTICS" },
  { id: "payment-plan", label: "Payment Plan", marker: "PAYMENT PLAN" },
  { id: "down-payment", label: "Down Payment", marker: "DOWN PAYMENT" },
]);

export const Route = createFileRoute("/_authenticated/sops/objection-handling-playbook")({
  head: () => ({ meta: [{ title: "Objection Handling Playbook · ISA" }] }),
  component: () => (
    <StyledSopPage
      icon={ShieldCheck}
      title="Objection Handling Playbook"
      description="Every closing objection and its handling path: think-about-it, partner, money, logistics, fear, and the closes that resolve them."
      badges={["Closing", "Playbook"]}
      sections={SECTIONS}
    />
  ),
});
