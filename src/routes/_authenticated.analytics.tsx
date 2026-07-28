import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy analytics bookmarks now resolve to the canonical Performance workspace.
export const Route = createFileRoute("/_authenticated/analytics")({
  beforeLoad: () => {
    throw redirect({ to: "/performance", replace: true });
  },
});
