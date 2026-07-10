import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /command — this stub preserves old bookmarks.
export const Route = createFileRoute("/_authenticated/founder-hq")({
  beforeLoad: () => {
    throw redirect({ to: "/command", search: { tab: "overview" }, replace: true });
  },
});
