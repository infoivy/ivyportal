import { createFileRoute, redirect } from "@tanstack/react-router";

// Sales activity dissolved (founder-approved 2026-07-28): the trends chart
// and the ops strip live in the Performance workspace now.
export const Route = createFileRoute("/_authenticated/sales")({
  beforeLoad: () => {
    throw redirect({ to: "/performance", replace: true });
  },
});
