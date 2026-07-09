import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DashboardPrefs = {
  showKpis: boolean;
  showOps: boolean;
  showMyDay: boolean;
  showInstallmentReminders: boolean;
  showGrowth: boolean;
  showFunnel: boolean;
  showCashLeaderboard: boolean;
  showTopSetters: boolean;
  showGoals: boolean;
  showTeamComp: boolean;
  showWeeklyLeaderboard: boolean;
  showQuickActions: boolean;
};

export const DEFAULT_PREFS: DashboardPrefs = {
  showKpis: true,
  showOps: true,
  showMyDay: true,
  showInstallmentReminders: true,
  showGrowth: true,
  showFunnel: true,
  showCashLeaderboard: true,
  showTopSetters: true,
  showGoals: true,
  showTeamComp: true,
  showWeeklyLeaderboard: true,
  showQuickActions: true,
};

export function useDashboardPrefs(userId: string | undefined) {
  const [prefs, setPrefs] = useState<DashboardPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("dashboard_prefs").eq("id", userId).maybeSingle();
      if (data?.dashboard_prefs && typeof data.dashboard_prefs === "object") {
        setPrefs({ ...DEFAULT_PREFS, ...(data.dashboard_prefs as Partial<DashboardPrefs>) });
      }
      setLoaded(true);
    })();
  }, [userId]);

  const save = async (next: DashboardPrefs) => {
    setPrefs(next);
    if (!userId) return;
    await supabase.from("profiles").update({ dashboard_prefs: next }).eq("id", userId);
  };

  return { prefs, save, loaded };
}
