import { createFileRoute, redirect } from "@tanstack/react-router";

// The standalone Mochi page merged into the CRM page's Mochi view long ago;
// this stub catches old bookmarks (portal sweep 2026-07-29).
export const Route = createFileRoute("/_authenticated/mochi")({
  beforeLoad: () => {
    throw redirect({ to: "/crm", replace: true });
  },
});
