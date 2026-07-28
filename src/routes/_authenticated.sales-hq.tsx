import { createFileRoute, redirect } from "@tanstack/react-router";

// Old bookmarks: sales-hq → sales → Performance (founder-approved 2026-07-28).
export const Route = createFileRoute("/_authenticated/sales-hq")({
  beforeLoad: () => {
    throw redirect({ to: "/performance", replace: true });
  },
});
