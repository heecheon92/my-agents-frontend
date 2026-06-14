"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { LocalizationProvider } from "@/providers/localization";
import { QueryProvider } from "@/providers/query";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LocalizationProvider>
      <TooltipProvider>
        <QueryProvider>{children}</QueryProvider>
      </TooltipProvider>
    </LocalizationProvider>
  );
}
