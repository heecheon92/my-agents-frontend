"use client";

import { LocalizationProvider } from "@/providers/localization";
import { QueryProvider } from "@/providers/query";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LocalizationProvider>
      <QueryProvider>{children}</QueryProvider>
    </LocalizationProvider>
  );
}
