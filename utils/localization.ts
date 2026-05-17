import type { Locale } from "@/i18n.config";
import { i18n } from "@/i18n.config";
import en from "@/localization/en.json";
import ko from "@/localization/ko.json";

const localization = {
  ko,
  en,
} as const;

export type Localization = (typeof localization)[typeof i18n.defaultLocale];

export function findLocalization(locale: Locale): Localization {
  return localization[locale] as Localization;
}

export const defaultLocalization = findLocalization(i18n.defaultLocale);
