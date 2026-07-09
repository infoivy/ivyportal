import type { Database } from "@/integrations/supabase/types";

export type DocCategory = Database["public"]["Enums"]["doc_category"];

export const DOC_CATEGORIES: { value: DocCategory; label: string }[] = [
  { value: "setting", label: "Setting" },
  { value: "closing", label: "Closing" },
  { value: "csm", label: "CSM" },
  { value: "coaching", label: "Coaching" },
  { value: "team_ops", label: "Team & Ops" },
  { value: "onboarding", label: "Onboarding" },
  { value: "content", label: "Content" },
];

export const CATEGORY_LABEL: Record<DocCategory, string> = Object.fromEntries(
  DOC_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<DocCategory, string>;

export const ALL_ROLES = ["admin", "closer", "setter", "coach", "csm", "student", "founder"] as const;
export type AppRole = (typeof ALL_ROLES)[number];

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export type ExternalLink = { label: string; url: string };
