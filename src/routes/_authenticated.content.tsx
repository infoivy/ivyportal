import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FounderPageContent } from "@/components/content/planner";
import { InstagramInner } from "@/components/content/instagram";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/content")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s.tab as string) ?? "plan",
  }),
  head: () => ({ meta: [{ title: "Content · ISA Portal" }] }),
  component: ContentPage,
});

const TABS = [
  { label: "Content", value: "plan" },
  { label: "Instagram", value: "instagram" },
] as const;

type Tab = (typeof TABS)[number]["value"];

function ContentPage() {
  const { roles } = useAuth();
  const canView = roles.includes("founder");
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/content" });

  if (!canView) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-2">
        <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
        <div className="text-title">Content</div>
        <p className="text-caption text-muted-foreground">Founder access required.</p>
      </div>
    );
  }

  const activeTab: Tab = tab === "instagram" ? "instagram" : "plan";

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display text-foreground">Content</h1>
          <p className="text-body text-muted-foreground mt-0.5">Planning, recording, and Instagram performance.</p>
        </div>
        <SegmentedControl
          segments={TABS}
          value={activeTab}
          onChange={(t) => navigate({ search: { tab: t }, replace: true })}
        />
      </header>

      {activeTab === "plan" ? <FounderPageContent /> : <InstagramInner />}
    </div>
  );
}
