import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Realtime sync keeps cached data fresh, so pages reuse cache on navigation
  // instead of refetching everything on every mount / window focus.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, gcTime: 30 * 60_000, refetchOnWindowFocus: false, retry: 1 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
