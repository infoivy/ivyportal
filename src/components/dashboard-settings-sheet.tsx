import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { DashboardPrefs } from "@/lib/dashboard-prefs";
import { DEFAULT_PREFS } from "@/lib/dashboard-prefs";

const SECTIONS: { key: keyof DashboardPrefs; label: string; description: string }[] = [
  { key: "showKpis", label: "KPI row", description: "The 9 headline metric tiles at the top" },
  { key: "showOps", label: "Ops today", description: "At-risk students, overdue installments, etc." },
  { key: "showMyDay", label: "My day", description: "Your personal task list" },
  { key: "showInstallmentReminders", label: "Installment reminders", description: "Payments due soon" },
  { key: "showGrowth", label: "Growth trend chart", description: "DMs / Convos / Booked over time" },
  { key: "showFunnel", label: "Funnel performance", description: "Volume by stage" },
  { key: "showCashLeaderboard", label: "Weekly cash leaderboard", description: "Top closer by cash this week" },
  { key: "showTopSetters", label: "Top performing setters", description: "Sorted by booked calls" },
  { key: "showGoals", label: "Quarterly goals", description: "Progress toward targets" },
  { key: "showTeamComp", label: "Team composition", description: "Active setters, EOD averages" },
  { key: "showWeeklyLeaderboard", label: "Setter weekly leaderboard", description: "This-week rollup by setter" },
  { key: "showQuickActions", label: "Quick actions", description: "Shortcut buttons at the bottom" },
];

export function DashboardSettingsSheet({
  open, onOpenChange, prefs, onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefs: DashboardPrefs;
  onChange: (next: DashboardPrefs) => void;
}) {
  const toggle = (k: keyof DashboardPrefs) => onChange({ ...prefs, [k]: !prefs[k] });
  const reset = () => onChange(DEFAULT_PREFS);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Dashboard settings</SheetTitle>
          <SheetDescription>Show or hide sections. Saved to your profile.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {SECTIONS.map((s) => (
            <label
              key={s.key}
              className="flex items-start gap-3 p-2.5 rounded-sm border border-border hover:bg-muted cursor-pointer"
            >
              <Checkbox checked={prefs[s.key]} onCheckedChange={() => toggle(s.key)} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-[11px] text-muted-foreground">{s.description}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-between">
          <Button variant="outline" size="sm" onClick={reset}>Reset defaults</Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
