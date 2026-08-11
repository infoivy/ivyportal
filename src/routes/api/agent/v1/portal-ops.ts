import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/agent/v1/portal-ops")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handlePortalOpsAgentGet } = await import("@/lib/portal-ops.server");
        return handlePortalOpsAgentGet(request);
      },
    },
  },
});
