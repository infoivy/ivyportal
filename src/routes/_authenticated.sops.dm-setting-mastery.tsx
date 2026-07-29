import { createFileRoute, redirect } from "@tanstack/react-router";

// DM Setting Mastery merged into the Setting Process page (founder-directed
// 2026-07-29); old links land on its DM board view.
export const Route = createFileRoute("/_authenticated/sops/dm-setting-mastery")({
  beforeLoad: () => {
    throw redirect({ to: "/sops/isa-setting-process", search: { mode: "dm" } as never, replace: true });
  },
});
