import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into /sales — this stub preserves old bookmarks.
export const Route = createFileRoute("/_authenticated/sales-hq")({
  beforeLoad: () => {
    throw redirect({ to: "/sales", search: { tab: "operations" }, replace: true });
  },
});
