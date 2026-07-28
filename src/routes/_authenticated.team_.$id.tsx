import { createFileRoute, redirect } from "@tanstack/react-router";

// Preserve old member-performance bookmarks while keeping Performance canonical.
export const Route = createFileRoute("/_authenticated/team_/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/performance",
      search: { member: params.id },
    });
  },
});
