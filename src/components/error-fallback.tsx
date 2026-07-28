import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";

/** A failed dynamic import means this tab was loaded on an OLD deploy and the
 *  hashed chunk it wants no longer exists on the current one. The only fix is
 *  a full reload onto the new build. Guarded so a genuinely broken deploy
 *  can't reload-loop. */
const RELOAD_FLAG = "isa-chunk-reload-at";
export function isStaleChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to load module script/i.test(msg);
}
/** Install once at the root: Vite fires "vite:preloadError" when a route
 *  chunk 404s (old tab, new deploy) — reload before the error boundary even
 *  shows. Returns a cleanup fn. */
export function installStaleChunkReload(): () => void {
  const onPreloadError = (e: Event) => {
    e.preventDefault(); // stop Vite from throwing — we're reloading anyway
    tryChunkReload();
  };
  window.addEventListener("vite:preloadError", onPreloadError);
  return () => window.removeEventListener("vite:preloadError", onPreloadError);
}

function tryChunkReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch { /* storage unavailable — reload anyway */ }
  window.location.reload();
  return true;
}

/** Route-level error boundary used as the router's defaultErrorComponent. */
export function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const stale = isStaleChunkError(error);
  useEffect(() => {
    if (stale) tryChunkReload();
  }, [stale]);
  if (stale) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full border border-[var(--border)] bg-[var(--card)] rounded-sm p-6 text-center">
          <div className="flex justify-center mb-3">
            <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
          </div>
          <div className="text-sm font-semibold text-foreground">New version available</div>
          <p className="text-[11px] text-muted-foreground mt-2">Reloading to the latest portal…</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-sm border border-[var(--border)] bg-[var(--background)] hover:bg-muted/50 text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> Reload now
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full border border-danger/25 bg-danger-bg rounded-sm p-6 text-center">
        <div className="flex justify-center mb-3">
          <div className="h-10 w-10 rounded-full bg-danger-bg text-danger-fg flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="text-sm font-semibold text-danger-fg">Something went wrong on this page</div>
        <p className="text-[11px] text-muted-foreground mt-2 break-words">
          {error?.message ?? "Unknown error"}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-sm border border-[var(--border)] bg-[var(--card)] hover:bg-muted/50 text-foreground"
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
