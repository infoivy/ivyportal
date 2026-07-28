import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { ArrowRight, HandCoins, WalletCards } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { money } from "@/lib/revenue";
import { getWhopCashWindow } from "@/lib/mochi.functions";
import { fetchCollectedCashByCloser } from "@/lib/collected-cash";
import { getPeriod } from "@/lib/payout-period";
import { fetchPeriodOwed } from "@/components/payout-alert";
import { BlurMoney } from "@/components/blur-money";

/**
 * Founder home money strip (founder-directed 2026-07-28: the home should
 * show the numbers): cash collected over the last 30 days and what the
 * current payout period owes, matching the Payouts headline. Leaders only;
 * lives outside the home route file so its money reads stay off that page.
 */
export function HomeMoneyStrip() {
  const { roles } = useAuth();
  const canSee = roles.some(r => ["admin", "founder", "cofounder"].includes(r));

  const today = format(new Date(), "yyyy-MM-dd");
  const from30 = format(subDays(new Date(), 29), "yyyy-MM-dd");

  const cashQ = useQuery({
    queryKey: ["page", "home", "money-30d"],
    enabled: canSee,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      // Whop is the cash truth; fall back to logged deals + paid installments
      // (labeled) only when Whop is not connected.
      try {
        const w = await getWhopCashWindow({ data: { from: from30, to: today } });
        if (w.connected) return { amount: w.net, source: "whop" as const };
      } catch { /* fall through to logged */ }
      const byCloser = await fetchCollectedCashByCloser(from30, today);
      let total = 0;
      for (const v of byCloser.values()) total += v.cash;
      return { amount: total, source: "logged" as const };
    },
  });

  const period = getPeriod(0);
  const payoutQ = useQuery({
    queryKey: ["page", "home", "payout-period", period.start],
    enabled: canSee,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const owed = await fetchPeriodOwed(period);
      return owed.reduce((s, m) => s + m.total, 0);
    },
  });

  if (!canSee) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link
        to="/finance"
        preload="intent"
        className="card-surface group flex items-center justify-between gap-4 p-5 hover:bg-muted/40 motion-safe:transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-muted-foreground">
            <HandCoins className="h-4 w-4" />
            <p className="text-micro font-semibold uppercase tracking-[0.1em]">Cash collected · last 30 days</p>
          </div>
          <p className="mt-3 text-[28px] font-medium leading-none tracking-[-0.02em] tabular-nums text-foreground">
            {cashQ.isLoading ? "…" : <BlurMoney>{money(cashQ.data?.amount ?? 0)}</BlurMoney>}
          </p>
          <p className="mt-2 text-caption text-muted-foreground">
            {cashQ.data?.source === "logged" ? "Logged deals + paid installments · Whop not connected" : "Whop net, after fees"}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
      </Link>
      <Link
        to="/payouts"
        preload="intent"
        className="card-surface group flex items-center justify-between gap-4 p-5 hover:bg-muted/40 motion-safe:transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-muted-foreground">
            <WalletCards className="h-4 w-4" />
            <p className="text-micro font-semibold uppercase tracking-[0.1em]">To pay out · {period.label}</p>
          </div>
          <p className="mt-3 text-[28px] font-medium leading-none tracking-[-0.02em] tabular-nums text-foreground">
            {payoutQ.isLoading ? "…" : <BlurMoney>{money(payoutQ.data ?? 0)}</BlurMoney>}
          </p>
          <p className="mt-2 text-caption text-muted-foreground">Live · moves with cash until the period closes</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
      </Link>
    </div>
  );
}
