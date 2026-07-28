import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceDirectory } from "@/components/workspace-directory";
import { useAuth } from "@/lib/auth-context";
import { useAccess } from "@/lib/use-access";
import { CUSTOMER_NAV_ITEMS, visibleItems } from "@/lib/portal-navigation";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers · Ivy Portal" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const { roles } = useAuth();
  const { pageHidden } = useAccess();
  const items = visibleItems(CUSTOMER_NAV_ITEMS, roles).filter((item) => !pageHidden(item.url));

  return (
    <WorkspaceDirectory
      eyebrow="Deliver"
      title="Customers"
      subtitle="Student delivery, coaching, health, calls, and proof in one clear operating area."
      items={items}
    />
  );
}
