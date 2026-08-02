import { useState } from "react";
import { friendlyPastDay } from "@/lib/dates";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type AuditRow = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
};

const ENTITY: Record<string, string> = {
  students: "student",
  student_action_items: "action item",
  student_calls: "1-on-1 call",
  eods: "EOD",
  deals: "deal",
  installments: "payment plan",
  installment_payments: "installment payment",
  business_expenses: "expense",
  payout_confirmations: "payout confirmation",
  user_roles: "role",
  commission_rates: "commission rate",
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

// Timestamps churn on every write and explain nothing.
const NOISY = new Set(["updated_at", "created_at", "reminded_3d_at", "reminded_1d_at"]);

const fmtVal = (v: unknown): string =>
  v == null || v === "" ? "empty"
  : typeof v === "boolean" ? (v ? "yes" : "no")
  : typeof v === "object" ? "…"
  : String(v).replaceAll("_", " ").slice(0, 40);

/** What actually changed: up to three "field: old → new" fragments. */
function changesOf(row: AuditRow): string | null {
  if (row.action !== "UPDATE" || !row.old_value || !row.new_value) return null;
  const parts: string[] = [];
  for (const key of Object.keys(row.new_value)) {
    if (NOISY.has(key)) continue;
    const before = row.old_value[key];
    const after = row.new_value[key];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    if (parts.length === 3) { parts.push("…"); break; }
    parts.push(`${key.replaceAll("_", " ")}: ${fmtVal(before)} → ${fmtVal(after)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function describe(row: AuditRow): string {
  const v = (row.new_value ?? row.old_value ?? {}) as Record<string, unknown>;
  const entity = ENTITY[row.table_name] ?? row.table_name.replaceAll("_", " ");
  const verb =
    row.action === "INSERT" ? (row.table_name === "eods" ? "submitted" : "added")
    : row.action === "DELETE" ? "deleted"
    : "updated";
  const label =
    str(v.student_name) ?? str(v.full_name) ?? str(v.name) ?? str(v.title) ??
    (row.table_name === "eods" ? str(v.report_date) : null) ??
    str(v.role) ?? str(v.key) ??
    (typeof v.text === "string" ? v.text.slice(0, 48) : null) ??
    (v.amount != null ? `$${Number(v.amount).toLocaleString()}` : null);
  return `${verb} ${entity}${label ? ` · ${label}` : ""}`;
}

/**
 * Everything anyone did, straight from the database triggers (founder
 * 2026-07-29: see who is active and when). Admin-only via audit_log RLS.
 */
export function TeamActivityLog() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [limit, setLimit] = useState(60);

  const q = useQuery({
    queryKey: ["page", "team", "activity", limit],
    enabled: isAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [logRes, profRes] = await Promise.all([
        (supabase.from("audit_log" as never).select("id, user_id, action, table_name, old_value, new_value, created_at").order("created_at", { ascending: false }).limit(limit) as unknown as Promise<{ data: AuditRow[] | null; error: { message: string } | null }>),
        supabase.from("profiles").select("id, display_name").eq("is_demo", false),
      ]);
      if (logRes.error) throw new Error(logRes.error.message);
      const names = new Map(((profRes.data ?? []) as { id: string; display_name: string | null }[]).map(p => [p.id, p.display_name ?? "Unnamed"]));
      return { rows: logRes.data ?? [], names };
    },
  });

  if (!isAdmin) return null;

  return (
    <section className="card-surface overflow-hidden">
      <header className="px-4 py-3 sm:px-5 border-b border-border flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-medium">Activity log</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Every portal action, newest first · logged by the database, times shown in your local time.</p>
        </div>
      </header>
      <div className="divide-y divide-border">
        {q.isLoading && <div className="p-5 text-xs text-muted-foreground">Loading activity…</div>}
        {q.isError && <div className="p-5 text-xs text-danger-fg">Could not load the log: {q.error instanceof Error ? q.error.message : "unknown error"}</div>}
        {q.data?.rows.length === 0 && <div className="p-5 text-xs text-muted-foreground">Nothing logged yet.</div>}
        {q.data?.rows.map(row => (
          <div key={row.id} className="px-4 sm:px-5 py-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-caption">
            <span className="text-micro tabular-nums text-muted-foreground w-[130px] shrink-0">{friendlyPastDay(row.created_at)} · {format(new Date(row.created_at), "HH:mm")}</span>
            <span className="font-medium text-foreground">{row.user_id ? q.data.names.get(row.user_id) ?? "Former member" : "System"}</span>
            <span className="text-muted-foreground">{describe(row)}</span>
            {changesOf(row) && <span className="text-micro text-muted-foreground/80">{changesOf(row)}</span>}
          </div>
        ))}
      </div>
      {q.data && q.data.rows.length >= limit && (
        <div className="px-4 py-2.5 border-t border-border">
          <button onClick={() => setLimit(l => l + 60)} className="text-caption text-muted-foreground hover:text-foreground">
            Show older activity
          </button>
        </div>
      )}
    </section>
  );
}
