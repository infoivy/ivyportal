/**
 * Client-side error reporting hook.
 *
 * Keep this dependency-free so the portal can run on any host. A future error
 * monitoring provider can be added here without changing route components.
 */
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) {
    console.error("[Ivy Portal] Unhandled client error", { error, ...context });
  }
}
