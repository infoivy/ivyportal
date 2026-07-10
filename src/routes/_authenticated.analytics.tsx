import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /sales — this stub preserves old bookmarks.
export const Route = createFileRoute("/_authenticated/analytics")({
  beforeLoad: () => {
    throw redirect({ to: "/sales", search: { tab: "trends" }, replace: true });
  },
});
