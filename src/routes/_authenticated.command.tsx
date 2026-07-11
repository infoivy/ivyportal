import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FounderHQInner } from "@/components/founder/founder-hq";
import { WeeklyReviewInner } from "@/components/founder/weekly-review";
import { TheRoomInner } from "@/components/founder/the-room";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/command")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s.tab as string) ?? "room",
  }),
  head: () => ({ meta: [{ title: "Gathering Hub — ISA Portal" }] }),
  component: CommandPage,
});

const TABS = [
  { label: "The Room", value: "room" },
  { label: "Overview", value: "overview" },
  { label: "Weekly Review", value: "weekly" },
] as const;

type Tab = (typeof TABS)[number]["value"];

function CommandPage() {
  const { roles } = useAuth();
  const canView = roles.includes("founder");
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/command" });

  if (!canView) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-2">
        <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
        <div className="text-title">Gathering Hub</div>
        <p className="text-caption text-muted-foreground">Founder access required.</p>
      </div>
    );
  }

  const activeTab: Tab = tab === "weekly" ? "weekly" : tab === "overview" ? "overview" : "room";

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-display text-foreground">Gathering Hub</h1>
          <p className="text-body text-muted-foreground mt-0.5">The business at a glance.</p>
        </div>
        <SegmentedControl
          segments={TABS}
          value={activeTab}
          onChange={(t) => navigate({ search: { tab: t }, replace: true })}
        />
      </header>

      {activeTab === "room" ? <TheRoomInner /> : activeTab === "overview" ? <FounderHQInner /> : <WeeklyReviewInner />}
    </div>
  );
}
