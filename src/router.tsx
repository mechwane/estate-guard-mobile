import { QueryClient } from "@tanstack/react-query";
import { createHashHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  if (typeof window !== "undefined" && window.location.pathname !== "/" && !window.location.hash) {
    window.history.replaceState(
      window.history.state,
      "",
      `/#${window.location.pathname}${window.location.search}`,
    );
  }

  const history = typeof document !== "undefined" ? createHashHistory() : undefined;

  const router = createRouter({
    routeTree,
    history,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
