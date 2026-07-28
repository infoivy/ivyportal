import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { DefaultErrorFallback } from "@/components/error-fallback";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,       // 1min · dashboards feel instant on nav
        gcTime: 5 * 60_000,      // 5min in memory
        // Internal tool: alt-tabbing back must self-heal stale pages. Focus
        // refetch respects staleTime, so fresh pages stay quiet.
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent", // hover/touchstart preloads route code
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorFallback,
  });

  return router;
};
