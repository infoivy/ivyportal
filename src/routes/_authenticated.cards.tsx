import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { keys, invalidateForTables } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { money } from "@/lib/revenue";
import { SPEND_CATEGORIES, spendNote } from "@/lib/wallet";
import { MoneyShell } from "@/components/money-shell";

export const Route = createFileRoute("/_authenticated/cards")({
  head: () => ({ meta: [{ title: "Cards · ISA" }] }),
  component: Cards,
});

/**
 * Whop card wallets (founder 2026-07-31). Each founder's payment-processor
 * card is loaded monthly with commissions + profit share; every load and
 * spend is a wallet entry. Balance = loaded − spent, and whatever is unspent
 * simply carries into the next month.
 */

type WalletEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  kind: "credit" | "spend";
  amount: number;
  note: string;
  created_by: string;
  created_at: string;
};

type Holder = { id: string; display_name: string | null };

function Cards() {
  const { roles } = useAuth();
  if (!roles.some((r) => ["founder", "cofounder"].includes(r))) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border border-border bg-card rounded-sm p-8 text-center text-sm text-muted-foreground">
          Founder access required.
        </div>
      </div>
    );
  }
  return <CardsInner />;
}

function CardsInner() {
  const { user } = useAuth();
  const pageQ = useQuery({
    queryKey: keys.cardsPage,
    queryFn: async () => {
      const [entriesRes, holdersRes] = await Promise.all([
        (supabase.from("wallet_entries" as any).select("*").order("entry_date", { ascending: false }).order("created_at", { ascending: false }) as any),
        supabase.from("user_roles").select("user_id").in("role", ["founder", "cofounder"]),
      ]);
      const holderIds = Array.from(new Set(((holdersRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id)));
      const { data: profs } = holderIds.length
        ? await supabase.from("profiles").select("id, display_name").eq("is_demo", false).in("id", holderIds)
        : { data: [] };
      return {
        entries: (entriesRes.data ?? []) as WalletEntry[],
        holders: ((profs ?? []) as Holder[]).sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? "")),
      };
    },
  });

  if (pageQ.isPending) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const entries = pageQ.data?.entries ?? [];
  const holders = pageQ.data?.holders ?? [];
  const byHolder = new Map<string, WalletEntry[]>();
  for (const e of entries) byHolder.set(e.user_id, [...(byHolder.get(e.user_id) ?? []), e]);

  return (
    <div className="min-h-full">
      <MoneyShell
        actions={
          <span className="text-[11px] text-muted-foreground hidden sm:block max-w-[320px] text-right">
            Balance = everything loaded minus everything spent. Unspent money carries into next month automatically.
          </span>
        }
      >
        <div className="space-y-4">
          {holders.map((h) => (
            <HolderCard
              key={h.id}
              holder={h}
              entries={byHolder.get(h.id) ?? []}
              isSelf={h.id === user?.id}
            />
          ))}
          {holders.length === 0 && (
            <div className="border border-border bg-card rounded-sm p-8 text-center text-sm text-muted-foreground">
              No card holders found.
            </div>
          )}
        </div>
      </MoneyShell>
    </div>
  );
}

const monthLabel = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });

function HolderCard({ holder, entries, isSelf }: {
  holder: Holder;
  entries: WalletEntry[];
  isSelf: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState<"credit" | "spend" | "balance" | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string>(SPEND_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => {
    const credited = entries.filter((e) => e.kind === "credit").reduce((s, e) => s + Number(e.amount), 0);
    const spent = entries.filter((e) => e.kind === "spend").reduce((s, e) => s + Number(e.amount), 0);
    return { credited, spent, balance: credited - spent };
  }, [entries]);

  const grouped = useMemo(() => {
    const map = new Map<string, WalletEntry[]>();
    for (const e of entries) {
      const key = e.entry_date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  // Month-by-month running balance: what came in, what carried in from the
  // previous month, and what carries out — the founder's "count what's left
  // for next month" view, computed instead of remembered.
  const monthSummary = useMemo(() => {
    const asc = [...grouped].sort((a, b) => a[0].localeCompare(b[0]));
    let running = 0;
    const map = new Map<string, { carryIn: number; loaded: number; spent: number; carryOut: number }>();
    for (const [ym, rows] of asc) {
      const loaded = rows.filter((r) => r.kind === "credit").reduce((s, r) => s + Number(r.amount), 0);
      const spentM = rows.filter((r) => r.kind === "spend").reduce((s, r) => s + Number(r.amount), 0);
      map.set(ym, { carryIn: running, loaded, spent: spentM, carryOut: running + loaded - spentM });
      running += loaded - spentM;
    }
    return map;
  }, [grouped]);

  const finalNote = adding === "spend" ? spendNote(category, note) : note.trim();
  const canSave = adding === "balance"
    ? amount.trim() !== "" && Number.isFinite(Number(amount)) && Math.abs(Number(amount) - stats.balance) >= 0.01
    : Number(amount) > 0 && finalNote.length >= 1;

  const save = async () => {
    if (!user || !adding || !canSave) return;
    setSaving(true);
    // "Set balance" writes the signed difference as its own audited entry
    // (founder 2026-07-31: the holders correct their own balance; the trust
    // circle plus the audit log is the control).
    const row = adding === "balance"
      ? (() => {
          const target = Math.round(Number(amount) * 100) / 100;
          const diff = Math.round((target - stats.balance) * 100) / 100;
          return {
            kind: diff > 0 ? "credit" : "spend",
            amount: Math.abs(diff),
            note: [`Balance correction · set to ${money(target)}`, note.trim()].filter(Boolean).join(" · "),
          };
        })()
      : { kind: adding, amount: Math.round(Number(amount) * 100) / 100, note: finalNote };
    const { error } = await (supabase.from("wallet_entries" as any).insert({
      user_id: holder.id,
      kind: row.kind,
      amount: row.amount,
      note: row.note,
      created_by: user.id,
    }) as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(adding === "credit" ? "Card loaded" : adding === "spend" ? "Spend logged" : "Balance corrected");
    setAdding(null); setAmount(""); setNote(""); setCategory(SPEND_CATEGORIES[0]);
    invalidateForTables(qc, ["wallet_entries"]);
  };

  const remove = async (e: WalletEntry) => {
    if (!confirm(`Remove this ${e.kind === "credit" ? "load" : "spend"} of ${money(Number(e.amount))}? The audit log keeps the record.`)) return;
    const { error } = await (supabase.from("wallet_entries" as any).delete().eq("id", e.id) as any);
    if (error) return toast.error(error.message);
    toast.success("Entry removed");
    invalidateForTables(qc, ["wallet_entries"]);
  };

  return (
    <section className="card-surface">
      <header className="px-5 py-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-foreground truncate">{holder.display_name ?? holder.id.slice(0, 8)}</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {money(stats.credited)} loaded all-time · {money(stats.spent)} spent
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground mb-1">{isSelf ? "Kept in the business" : "Balance on card"}</div>
          <div className={`text-[24px] font-medium tabular-nums leading-none ${stats.balance < 0 ? "text-danger-fg" : ""}`}>{money(stats.balance)}</div>
        </div>
      </header>

      <div className="px-5 py-3">
        {adding ? (
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <span className="text-[12px] font-medium text-foreground">{adding === "credit" ? "Load card" : adding === "spend" ? "Log spend" : "Set the true balance"}</span>
            <input
              autoFocus
              placeholder={adding === "balance" ? money(stats.balance) : "Amount"}
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setAdding(null); }}
              className="h-8 w-24 px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-right text-[12px] tabular-nums focus:outline-none focus:border-ring"
            />
            {adding === "spend" && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-8 rounded-sm border border-[var(--border)] bg-[var(--background)] px-2 text-[12px] focus:outline-none focus:border-ring"
              >
                {SPEND_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <input
              placeholder={adding === "credit" ? "What for (e.g. August profit share + commissions)" : adding === "balance" ? "Why it was off (optional)" : "Detail (optional)"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setAdding(null); }}
              className="h-8 flex-1 min-w-[160px] px-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-[12px] focus:outline-none focus:border-ring"
            />
            <button
              disabled={saving || !canSave}
              onClick={() => void save()}
              className="h-8 px-3 rounded-sm bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40"
            >
              Save
            </button>
            <button onClick={() => { setAdding(null); setAmount(""); setNote(""); }} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pb-3">
            <button onClick={() => setAdding("credit")} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
              <Plus className="h-3 w-3" /> Load card
            </button>
            <span className="text-muted-foreground/40">·</span>
            <button onClick={() => setAdding("spend")} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
              <Minus className="h-3 w-3" /> Log spend
            </button>
            <span className="text-muted-foreground/40">·</span>
            <button onClick={() => { setAdding("balance"); setAmount(""); }} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline" title="Type the card's real balance; the difference is logged as a correction">
              <CreditCard className="h-3 w-3" /> Set balance
            </button>
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-[12px] text-muted-foreground pb-2">Nothing on this card yet. Load it with their commissions and profit share.</p>
        ) : (
          <div className="space-y-2 pb-1">
            {grouped.map(([ym, rows]) => {
              const ms = monthSummary.get(ym);
              return (
              <div key={ym}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {monthLabel(ym + "-01")}
                  </span>
                  {ms && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {ms.carryIn > 0 ? `carried in ${money(ms.carryIn)} · ` : ""}loaded {money(ms.loaded)} · spent {money(ms.spent)} · carries out {money(ms.carryOut)}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {rows.map((e) => (
                    <div key={e.id} className="group flex items-center gap-3 text-[12px] rounded-md px-2 py-1 hover:bg-muted/60 motion-safe:transition-colors">
                      <span className="tabular-nums text-muted-foreground w-[72px] shrink-0">{e.entry_date}</span>
                      <span className="flex-1 min-w-0 truncate text-foreground">{e.note}</span>
                      <span className={`tabular-nums font-medium shrink-0 ${e.kind === "spend" ? "text-danger-fg" : "text-success-fg"}`}>
                        {e.kind === "spend" ? "−" : "+"}{money(Number(e.amount))}
                      </span>
                      <button
                        onClick={() => void remove(e)}
                        className="p-1 rounded-sm text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-danger-fg hover:bg-danger-bg shrink-0 motion-safe:transition-colors"
                        title="Remove entry"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
