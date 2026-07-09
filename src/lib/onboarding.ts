import { supabase } from "@/integrations/supabase/client";

export type OnboardingStep = {
  id: string;
  label: string;
  kind: "doc" | "video" | "action" | "link";
  target: string;
  note?: string;
};

export type OnboardingTemplate = {
  id: string;
  role: string;
  title: string;
  description: string | null;
  steps: OnboardingStep[];
};

export async function fetchTemplateForRole(role: string): Promise<OnboardingTemplate | null> {
  const { data } = await supabase
    .from("onboarding_templates")
    .select("*")
    .eq("role", role as any)
    .maybeSingle();
  if (!data) return null;
  return { ...(data as any), steps: (data as any).steps ?? [] };
}

export async function fetchAllTemplates(): Promise<OnboardingTemplate[]> {
  const { data } = await supabase.from("onboarding_templates").select("*").order("role");
  return ((data ?? []) as any[]).map(t => ({ ...t, steps: t.steps ?? [] }));
}

export async function fetchProgress(userId: string, role?: string): Promise<Set<string>> {
  let q = supabase.from("onboarding_progress").select("step_id, role").eq("user_id", userId);
  if (role) q = q.eq("role", role as any);
  const { data } = await q;
  return new Set((data ?? []).map((r: any) => `${r.role}:${r.step_id}`));
}

export async function toggleStep(userId: string, role: string, stepId: string, done: boolean) {
  if (done) {
    await supabase.from("onboarding_progress").insert({ user_id: userId, role: role as any, step_id: stepId } as any);
  } else {
    await supabase.from("onboarding_progress").delete().eq("user_id", userId).eq("role", role as any).eq("step_id", stepId);
  }
}

export function progressPercent(steps: OnboardingStep[], done: Set<string>, role: string): number {
  if (!steps.length) return 100;
  const complete = steps.filter(s => done.has(`${role}:${s.id}`)).length;
  return Math.round((complete / steps.length) * 100);
}
