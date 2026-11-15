"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { queryClientDefaults } from "@/lib/query-keys";

/**
 * TanStack Query for client-side async calls (server actions and fetches made from
 * client components). Server Components keep loading their data on the server.
 * The client lives in state so each browser session (and each server render) gets its own.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: queryClientDefaults }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
