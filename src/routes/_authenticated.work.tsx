import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { WorkspaceDirectory } from "@/components/workspace-directory";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAccess } from "@/lib/use-access";
import { WORK_NAV_ITEMS } from "@/lib/portal-navigation";

export const Route = createFileRoute("/_authenticated/work")({
  head: () => ({ meta: [{ title: "Work · Ivy Portal" }] }),
  component: WorkPage,
});

function WorkPage() {
  const { roles } = useAuth();
  const { canSee } = useAccess();
  const crmQ = useQuery({
    queryKey: ["workspace", "crm-enabled"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("founder_settings").select("crm_enabled").maybeSingle();
      return Boolean((data as { crm_enabled?: boolean } | null)?.crm_enabled);
    },
  });

  const items = WORK_NAV_ITEMS.filter((item) => {
    if (!canSee(item)) return false;
    if (item.key === "crm" && crmQ.data === false) return false;
    return true;
  });

  return (
    <WorkspaceDirectory
      eyebrow="Operate"
      title="Work"
      subtitle="The queues and records that need action. Performance reporting lives in one separate workspace."
      items={items}
    />
  );
}
