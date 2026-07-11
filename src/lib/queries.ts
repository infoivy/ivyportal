import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared queryOptions used across routes. Same key + fn = TanStack Query
 * dedupes concurrent requests and reuses cache between pages.
 */

export const studentsQuery = () =>
  queryOptions({
    queryKey: ["students", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

export const coachesQuery = () =>
  queryOptions({
    queryKey: ["coaches", "all"],
    queryFn: async () => {
      // Both tables are small — fetch in parallel and join client-side
      const [rolesRes, profsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("role", ["coach", "admin"]),
        supabase.from("profiles").select("id, display_name"),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (profsRes.error) throw profsRes.error;
      const ids = new Set((rolesRes.data ?? []).map(r => r.user_id));
      return ((profsRes.data ?? []) as { id: string; display_name: string | null }[]).filter(p => ids.has(p.id));
    },
    staleTime: 5 * 60_000, // 5min — coach roster changes rarely
  });

export const studentCallsAggQuery = () =>
  queryOptions({
    queryKey: ["student_calls", "agg"],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_calls")
        .select("student_id, call_date, status")
        .order("call_date", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const lastCall: Record<string, string> = {};
      const callsUsed: Record<string, number> = {};
      (data ?? []).forEach((c: any) => {
        if (!lastCall[c.student_id]) lastCall[c.student_id] = c.call_date;
        if (c.status === "completed") callsUsed[c.student_id] = (callsUsed[c.student_id] ?? 0) + 1;
      });
      return { lastCall, callsUsed };
    },
    staleTime: 60_000,
  });

export const studentEodsAggQuery = () =>
  queryOptions({
    queryKey: ["student_eods", "agg"],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_eods")
        .select("student_id, report_date, applications_submitted")
        .order("report_date", { ascending: false })
        .limit(3000);
      if (error) throw error;
      const lastEod: Record<string, string> = {};
      const apps7d: Record<string, number> = {};
      const cutoff = Date.now() - 7 * 86400000;
      (data ?? []).forEach((e: any) => {
        if (!lastEod[e.student_id]) lastEod[e.student_id] = e.report_date;
        if (new Date(e.report_date).getTime() >= cutoff) {
          apps7d[e.student_id] = (apps7d[e.student_id] ?? 0) + (e.applications_submitted ?? 0);
        }
      });
      return { lastEod, apps7d };
    },
    staleTime: 60_000,
  });

export const docsListQuery = (role?: string) =>
  queryOptions({
    queryKey: ["docs", "list", role ?? "all"],
    queryFn: async () => {
      let q = supabase.from("docs").select("id, slug, title, category, pinned, sort_order, role_visibility, updated_at").order("pinned", { ascending: false }).order("sort_order");
      if (role) q = q.contains("role_visibility", [role]);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000, // docs are read-heavy, edit-light
  });
