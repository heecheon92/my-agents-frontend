"use client";

import { QueryProvider } from "@/providers/query";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
