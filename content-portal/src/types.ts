export type ContentStage =
  | "idea"
  | "research"
  | "script"
  | "ready"
  | "recorded"
  | "editing"
  | "scheduled"
  | "published"
  | "repurpose";

export type ContentPiece = {
  id: string;
  title: string;
  hook: string;
  core_idea: string | null;
  pillar: string;
  funnel_stage: "tof" | "mof" | "bof";
  format: string;
  primary_platform: string;
  status: ContentStage;
  scheduled_for: string | null;
  published_at: string | null;
  post_url: string | null;
  script: string | null;
  cta: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  leads: number;
  booked_calls: number;
  sales: number;
  attributed_revenue: number;
  avg_watch_seconds: number | null;
  retention_percent: number | null;
  created_at: string;
  updated_at: string;
};

export type NavId = "command" | "pipeline" | "library" | "analytics" | "systems";
