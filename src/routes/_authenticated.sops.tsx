import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sops")({
  head: () => ({ meta: [{ title: "SOPs — ISA Team" }] }),
  beforeLoad: ({ location }) => {
    if (location.pathname === "/sops" || location.pathname === "/sops/") {
      throw redirect({ to: "/knowledge" as string });
    }
  },
  component: () => {
    // Fallback: if somehow on /sops, redirect via router
    useRouterState({ select: (s) => s.location.pathname });
    return <Outlet />;
  },
});
