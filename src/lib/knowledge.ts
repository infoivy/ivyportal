import type { Database } from "@/integrations/supabase/types";

export type DocCategory = Database["public"]["Enums"]["doc_category"];

// Team-facing categories only. "content" is intentionally excluded — content
// SOPs now live in Founder Hub (see /founder → SOPs & Playbooks tab).
export const DOC_CATEGORIES: { value: DocCategory; label: string }[] = [
  { value: "setting", label: "Setting" },
  { value: "closing", label: "Closing" },
  { value: "csm", label: "CSM" },
  { value: "coaching", label: "Coaching" },
  { value: "team_ops", label: "Team & Ops" },
  { value: "onboarding", label: "Onboarding" },
];

// Label map still covers the "content" enum value so legacy references render
// something sensible if a founder-only doc leaks into a team surface.
export const CATEGORY_LABEL: Record<DocCategory, string> = {
  setting: "Setting",
  closing: "Closing",
  csm: "CSM",
  coaching: "Coaching",
  team_ops: "Team & Ops",
  onboarding: "Onboarding",
  content: "Content",
};

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
