import { createFileRoute, Navigate } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";
import { DocShell } from "@/components/doc-shell";
import { DmSetterPlaybook, PLAYBOOK_SECTIONS } from "@/components/dm-setter-playbook";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/sops/dm-setter-playbook")({
  head: () => ({ meta: [{ title: "DM Setter Playbook · ISA" }] }),
  component: DmSetterPlaybookPage,
});

function DmSetterPlaybookPage() {
  const { roles } = useAuth();
  // Team material: students never see setter scripts.
  if (roles.length > 0 && roles.every((r) => r === "student")) {
    return <Navigate to="/knowledge" replace />;
  }

  return (
    <DocShell
      breadcrumb={{ to: "/knowledge", label: "Knowledge Hub", current: "DM Setter Playbook" }}
      icon={MessagesSquare}
      title="DM Setter Playbook"
      description="The full DM setting system, in the order things actually happen: from the first reply to the call, and everything after. Read it top to bottom on day one, then keep it open while you work."
      badges={["Setting", "DM setters", "Playbook"]}
      sections={PLAYBOOK_SECTIONS}
    >
      <DmSetterPlaybook />
    </DocShell>
  );
}
