import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sops")({
  beforeLoad: () => { throw redirect({ to: "/knowledge" }); },
  component: () => null,
});
