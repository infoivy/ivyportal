import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /command — this stub preserves old bookmarks.
export const Route = createFileRoute("/_authenticated/weekly-review")({
  beforeLoad: () => {
    throw redirect({ to: "/command", search: { tab: "weekly" }, replace: true });
  },
});
