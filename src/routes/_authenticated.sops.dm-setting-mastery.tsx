import { createFileRoute, redirect } from "@tanstack/react-router";

// DM Setting Mastery merged into the Setting Process page (2026-07-29), which
// was retired for the DM Setter Playbook (2026-09-25). Old links land there.
export const Route = createFileRoute("/_authenticated/sops/dm-setting-mastery")({
  beforeLoad: () => {
    throw redirect({ to: "/sops/dm-setter-playbook", replace: true });
  },
});
