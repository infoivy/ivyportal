import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FounderHQInner } from "./_authenticated.founder-hq";
import { FounderPageContent } from "./_authenticated.founder";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/command")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s.tab as string) ?? "overview",
  }),
  head: () => ({ meta: [{ title: "Command — ISA Portal" }] }),
  component: CommandPage,
});

const TABS = [
  { label: "Overview", value: "overview" },
  { label: "Content", value: "content" },
] as const;

type Tab = typeof TABS[number]["value"];

function CommandPage() {
  const { roles } = useAuth();
  const canView = roles.includes("admin") || roles.includes("founder");
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/command" });

  if (!canView) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-2">
        <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
        <div className="text-[15px] font-semibold">Command</div>
        <p className="text-[13px] text-muted-foreground">Founder or admin access required.</p>
      </div>
    );
  }

  const activeTab = (tab as Tab) ?? "overview";

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] text-foreground leading-none">Command</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Overview, content pipeline, and team.</p>
        </div>
        <SegmentedControl
          segments={TABS}
          value={activeTab}
          onChange={t => navigate({ search: { tab: t }, replace: true })}
        />
      </header>

      {activeTab === "overview" ? (
        <FounderHQInner />
      ) : (
        <FounderPageContent />
      )}
    </div>
  );
}
