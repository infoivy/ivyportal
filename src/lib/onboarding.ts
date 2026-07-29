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


export async function fetchAllTemplates(): Promise<OnboardingTemplate[]> {
  const { data } = await supabase.from("onboarding_templates").select("*").order("role");
  return ((data ?? []) as any[]).map(t => ({ ...t, steps: t.steps ?? [] }));
}



export function progressPercent(steps: OnboardingStep[], done: Set<string>, role: string): number {
  if (!steps.length) return 100;
  const complete = steps.filter(s => done.has(`${role}:${s.id}`)).length;
  return Math.round((complete / steps.length) * 100);
}
