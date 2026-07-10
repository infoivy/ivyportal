import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";

/** Route-level error boundary used as the router's defaultErrorComponent. */
export function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full border border-red-500/30 bg-red-500/5 rounded-sm p-6 text-center">
        <div className="flex justify-center mb-3">
          <div className="h-10 w-10 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="text-sm font-semibold text-red-300">Something went wrong on this page</div>
        <p className="text-[11px] text-muted-foreground mt-2 font-mono break-words">
          {error?.message ?? "Unknown error"}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-sm border border-[#1f2530] bg-[#0f1116] hover:bg-[#141821] text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
          <button
            onClick={() => router.navigate({ to: "/dashboard" })}
            className="text-[11px] px-3 py-1.5 rounded-sm text-muted-foreground hover:text-foreground"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
