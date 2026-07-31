import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CreditCard, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invalidateForTables } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { money } from "@/lib/revenue";
import { BlurMoney } from "@/components/blur-money";

/**
 * My-card tile on the founder home (founder 2026-07-31): balance at a
 * glance plus quick "load card" / "log spend" without opening /cards.
 * Founder + co-founders only — the only card holders.
 */
export function HomeCardTile() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const isHolder = roles.some((r) => ["founder", "cofounder"].includes(r));
  const [adding, setAdding] = useState<"credit" | "spend" | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const cardQ = useQuery({
    queryKey: ["page", "home", "card", user?.id],
    enabled: isHolder && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("wallet_entries" as any)
        .select("kind, amount")
        .eq("user_id", user!.id) as any);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { kind: "credit" | "spend"; amount: number }[];
      const loaded = rows.filter((r) => r.kind === "credit").reduce((s, r) => s + Number(r.amount), 0);
      const spent = rows.filter((r) => r.kind === "spend").reduce((s, r) => s + Number(r.amount), 0);
      return { loaded, spent, balance: loaded - spent };
    },
  });

  if (!isHolder) return null;

  const save = async () => {
    const amt = Number(amount);
    if (!user || !adding || !(amt > 0) || note.trim().length < 3) return;
    setSaving(true);
    const { error } = await (supabase.from("wallet_entries" as any).insert({
      user_id: user.id,
      kind: adding,
      amount: Math.round(amt * 100) / 100,
      note: note.trim(),
      created_by: user.id,
    }) as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(adding === "credit" ? "Card loaded" : "Spend logged");
    setAdding(null); setAmount(""); setNote("");
    invalidateForTables(qc, ["wallet_entries"]);
  };

  return (
    <div className="card-surface flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          <p className="text-micro font-semibold uppercase tracking-[0.1em]">My card · kept in the business</p>
        </div>
        <p className="mt-3 text-[28px] font-medium leading-none tracking-[-0.02em] tabular-nums text-foreground">
          {cardQ.isLoading ? "…" : <BlurMoney>{money(cardQ.data?.balance ?? 0)}</BlurMoney>}
        </p>
        <p className="mt-2 text-caption text-muted-foreground tabular-nums">
          {money(cardQ.data?.loaded ?? 0)} loaded · {money(cardQ.data?.spent ?? 0)} spent
        </p>
      </div>
      <div className="flex flex-col items-stretch gap-2 min-w-[240px] flex-1 sm:flex-none">
        {adding ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-foreground w-full sm:w-auto">{adding === "credit" ? "Load card" : "Log spend"}</span>
            <input
              autoFocus
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setAdding(null); }}
              className="h-9 w-24 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-right text-[13px] tabular-nums focus:outline-none focus:border-ring"
            />
            <input
              placeholder="What for"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setAdding(null); }}
              className="h-9 flex-1 min-w-[130px] px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[13px] focus:outline-none focus:border-ring"
            />
            <button
              disabled={saving || !(Number(amount) > 0) || note.trim().length < 3}
              onClick={() => void save()}
              className="h-9 px-3 rounded-sm bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              Save
            </button>
            <button onClick={() => { setAdding(null); setAmount(""); setNote(""); }} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setAdding("spend")} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-[12px] font-medium motion-safe:transition-colors">
              <Minus className="h-3.5 w-3.5" /> Log spend
            </button>
            <button onClick={() => setAdding("credit")} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-[12px] font-medium motion-safe:transition-colors">
              <Plus className="h-3.5 w-3.5" /> Load card
            </button>
            <Link to="/revenue" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-[12px] font-medium motion-safe:transition-colors">
              Log a close <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to={"/cards" as string} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground px-1">
              Open cards <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
