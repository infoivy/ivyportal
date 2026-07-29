import { createFileRoute, redirect } from "@tanstack/react-router";

// The read-only directory merged into Team administration, which now wears
// its look with the admin controls (founder-directed 2026-07-29). Old links
// land there; /team itself stays admin-only.
export const Route = createFileRoute("/_authenticated/directory")({
  beforeLoad: () => {
    throw redirect({ to: "/team", replace: true });
  },
});
