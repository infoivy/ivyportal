import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /content — this stub preserves old bookmarks.
export const Route = createFileRoute("/_authenticated/instagram")({
  beforeLoad: () => {
    throw redirect({ to: "/content", search: { tab: "instagram" }, replace: true });
  },
});
