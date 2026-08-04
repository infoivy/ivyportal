import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceDirectory } from "@/components/workspace-directory";
import { useAuth } from "@/lib/auth-context";
import { useAccess } from "@/lib/use-access";
import { CUSTOMER_NAV_ITEMS } from "@/lib/portal-navigation";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers · Ivy Portal" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const { roles } = useAuth();
  const { canSee } = useAccess();
  const items = CUSTOMER_NAV_ITEMS.filter((item) => canSee(item));

  return (
    <WorkspaceDirectory
      eyebrow="Deliver"
      title="Customers"
      subtitle="Student delivery, coaching, health, calls, and proof in one clear operating area."
      items={items}
    />
  );
}
