import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/policies/")({
  beforeLoad: () => {
    throw redirect({ to: "/knowledge" as string });
  },
  component: () => null,
});
