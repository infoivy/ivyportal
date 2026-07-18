import { createFileRoute } from "@tanstack/react-router";
import { Instagram } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { MochiCrmInner } from "@/components/mochi-crm";

export const Route = createFileRoute("/_authenticated/mochi")({
  head: () => ({ meta: [{ title: "Instagram CRM · ISA Portal" }] }),
  component: MochiPage,
});

function MochiPage() {
  const { roles } = useAuth();
  const canView = roles.includes("admin") || roles.includes("founder");
  if (!canView) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-2">
        <Instagram className="h-8 w-8 mx-auto text-muted-foreground" />
        <div className="text-title">Instagram CRM</div>
        <p className="text-caption text-muted-foreground">Admin or founder access required.</p>
      </div>
    );
  }
  return <MochiCrmInner />;
}
