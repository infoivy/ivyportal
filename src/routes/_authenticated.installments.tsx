import { createFileRoute, redirect } from "@tanstack/react-router";

// Installments merged into Money in (founder-approved 2026-07-28).
export const Route = createFileRoute("/_authenticated/installments")({
  beforeLoad: () => {
    throw redirect({ to: "/revenue", search: { tab: "plans" }, replace: true });
  },
});
