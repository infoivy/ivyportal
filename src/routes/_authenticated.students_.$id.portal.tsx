import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StudentSandboxContext } from "@/lib/student-sandbox";
import { StudentPortal } from "./_authenticated.student-portal";

export const Route = createFileRoute("/_authenticated/students_/$id/portal")({
  head: () => ({ meta: [{ title: "Student view · ISA" }] }),
  component: StudentPortalSandbox,
});

/**
 * Staff sandbox: the REAL student portal page rendered for the chosen
 * student. Reads are live; every action is simulated locally so staff can
 * complete steps, fill forms, and feel the entire student experience without
 * saving anything, pinging anyone, or touching the student's record.
 * Pure students never reach this route (central gate in _authenticated.tsx).
 */
function StudentPortalSandbox() {
  const { id } = Route.useParams() as { id: string };
  const sandbox = useMemo(() => ({ studentId: id }), [id]);
  // Remounting the portal re-reads real data, wiping every simulated action.
  const [resetKey, setResetKey] = useState(0);

  const nameQ = useQuery({
    queryKey: ["students", "sandbox-name", id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("students").select("full_name").eq("id", id).maybeSingle();
      return data?.full_name ?? null;
    },
  });

  return (
    <StudentSandboxContext.Provider value={sandbox}>
      <div className="sticky top-14 sm:top-[52px] z-20 border-b border-primary/25 bg-primary/10 backdrop-blur px-3 sm:px-5 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          <Eye className="h-3.5 w-3.5" /> Student view
        </span>
        <span className="text-[12px] text-foreground min-w-0 truncate">
          You are seeing the portal exactly as <span className="font-semibold">{nameQ.data ?? "this student"}</span> sees it.
          Click around, fill things in, complete steps: it is a sandbox, nothing is saved and no one is notified.
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setResetKey(k => k + 1)}
            className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground motion-safe:transition-colors"
            title="Discard your simulated actions and reload their real state"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
          <Link
            to="/students/$id"
            params={{ id }}
            className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 motion-safe:transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Exit student view
          </Link>
        </span>
      </div>
      <StudentPortal key={resetKey} />
    </StudentSandboxContext.Provider>
  );
}
