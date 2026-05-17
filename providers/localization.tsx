"use client";

import { createContext } from "react";
import type { Locale } from "@/i18n.config";
import { i18n } from "@/i18n.config";
import { defaultLocalization, type Localization } from "@/utils/localization";

export type LocalizationState = {
  lang: Locale;
  localization: Localization;
  isLoaded: boolean;
};

export const LocalizationContext = createContext<LocalizationState | null>(
  null,
);

export function LocalizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocalizationContext.Provider
      value={{
        isLoaded: true,
        lang: i18n.defaultLocale,
        localization: defaultLocalization,
      }}
    >
      {children}
    </LocalizationContext.Provider>
  );
}
