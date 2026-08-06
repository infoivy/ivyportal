import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { KpiRule } from "@/lib/eod-kpi";

/** Leadership-editable KPI eras (kpi_targets). Loaded once and passed into
 *  kpiTargetsFor/didHitKpi/dayStatus; the static config stays the fallback
 *  while this loads. */
export function useKpiRules(): KpiRule[] {
  const q = useQuery({
    queryKey: ["org", "kpi-rules"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase
        .from("kpi_targets" as never)
        .select("setter_type, effective_from, primary_target, secondary_target, sets_target")
        .order("effective_from", { ascending: true }) as never as Promise<{ data: KpiRule[] | null }>);
      return (data ?? []) as KpiRule[];
    },
  });
  return q.data ?? [];
}
