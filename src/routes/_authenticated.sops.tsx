import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sops")({
  head: () => ({ meta: [{ title: "SOPs · ISA Team" }] }),
  beforeLoad: ({ location }) => {
    if (location.pathname === "/sops" || location.pathname === "/sops/") {
      throw redirect({ to: "/knowledge" as string });
    }
  },
  component: SopsLayout,
});

function SopsLayout() {
  return <Outlet />;
}
