import { createFileRoute, redirect } from "@tanstack/react-router";

// The old Setting Process (guided workflow, script library, DM board) was
// retired on 2026-09-25 (founder-directed): the DM Setter Playbook is the
// main DM setting script now. Old links and bookmarks land there.
export const Route = createFileRoute("/_authenticated/sops/isa-setting-process")({
  beforeLoad: () => {
    throw redirect({ to: "/sops/dm-setter-playbook", replace: true });
  },
});
