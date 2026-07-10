import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /content — this stub preserves old bookmarks.
export const Route = createFileRoute("/_authenticated/founder")({
  beforeLoad: () => {
    throw redirect({ to: "/content", search: { tab: "plan" }, replace: true });
  },
});
