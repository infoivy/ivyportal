import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Circle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { keys, invalidateForTables } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { humanDue } from "@/lib/dates";

/**
 * The signed-in member's OWN open action items, pinned above the command
 * queue (founder 2026-08-01: "if any action items are added to that person
 * it should show on top of the home view"). Items new in the last 48 hours
 * carry a native-style red dot; ticking the circle completes the item.
 */

type MyItem = {
  id: string;
  text: string;
  due_date: string | null;
  created_at: string;
  student_id: string | null;
  students: { full_name: string } | null;
};

export function HomeMyItems() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const itemsQ = useQuery({
    queryKey: [...keys.dashboardMyItems, "open-list"],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_action_items")
        .select("id, text, due_date, created_at, student_id, students(full_name)")
        .eq("is_demo", false)
        .eq("assignee_id", user!.id)
        .eq("done", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as MyItem[];
    },
  });

  const items = itemsQ.data ?? [];
  if (items.length === 0) return null;

  const isNew = (iso: string) => Date.now() - new Date(iso).getTime() < 48 * 3600_000;
  const newCount = items.filter((i) => isNew(i.created_at)).length;

  const complete = async (item: MyItem) => {
    const { error } = await supabase
      .from("student_action_items")
      .update({ done: true } as never)
      .eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Action item done");
    invalidateForTables(qc, ["student_action_items"]);
  };

  return (
    <section className="card-surface overflow-hidden" aria-labelledby="my-items-title">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 pb-3 pt-4 sm:px-6">
        <div className="flex items-center gap-2">
          <p id="my-items-title" className="text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Your action items
          </p>
          {newCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-bg border border-danger/25 px-2 py-0.5 text-[10px] font-semibold text-danger-fg">
              <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
              {newCount} new
            </span>
          )}
        </div>
        <Link to={"/action-items" as string} className="text-caption text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0">
          All items <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
            <button
              onClick={() => void complete(item)}
              className="group/tick shrink-0 p-1 -m-1 text-muted-foreground hover:text-success-fg motion-safe:transition-colors"
              title="Mark done"
              aria-label={`Mark done: ${item.text}`}
            >
              <Circle className="h-[18px] w-[18px] group-hover/tick:hidden" />
              <CheckCircle2 className="h-[18px] w-[18px] hidden group-hover/tick:block" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-body text-foreground truncate flex items-center gap-2">
                {isNew(item.created_at) && <span className="h-2 w-2 rounded-full bg-danger shrink-0" title="New" aria-label="New" />}
                {item.text}
              </p>
              <p className="text-caption text-muted-foreground truncate">
                {item.students?.full_name && item.student_id ? (
                  <Link to="/students/$id" params={{ id: item.student_id }} className="hover:text-foreground hover:underline">
                    {item.students.full_name}
                  </Link>
                ) : "Team"}
                {item.due_date && <span className={item.due_date < new Date().toISOString().slice(0, 10) ? " text-danger-fg" : ""}> · {humanDue(item.due_date)}</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
