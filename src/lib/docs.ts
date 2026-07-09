export const DOC_CATEGORIES = [
  { value: "setting", label: "Setting" },
  { value: "closing", label: "Closing" },
  { value: "csm", label: "CSM" },
  { value: "coaching", label: "Coaching" },
  { value: "team_ops", label: "Team & Ops" },
  { value: "onboarding", label: "Onboarding" },
  { value: "content", label: "Content" },
] as const;

export type DocCategory = typeof DOC_CATEGORIES[number]["value"];

export const ALL_ROLES = ["admin", "closer", "setter", "coach", "csm", "student"] as const;

export type Doc = {
  id: string;
  title: string;
  slug: string;
  category: DocCategory;
  content: string;
  role_visibility: string[];
  sort_order: number;
  pinned: boolean;
  external_links: { label: string; url: string }[];
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

export function slugifyTitle(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}
