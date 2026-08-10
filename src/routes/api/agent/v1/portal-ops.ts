import { createFileRoute } from "@tanstack/react-router";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

export const Route = createFileRoute("/api/agent/v1/portal-ops")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authorizeAgentRequest, buildPortalOpsReport } = await import("@/lib/portal-ops.server");
        if (!authorizeAgentRequest(request)) return json({ error: "Unauthorized" }, 401);

        try {
          return json(await buildPortalOpsReport());
        } catch (error) {
          console.error(
            "[portal-ops-agent] report failed",
            error instanceof Error ? error.message : "Unknown report error",
          );
          return json({ error: "Portal report unavailable" }, 500);
        }
      },
    },
  },
});
