"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_THEME_PREFERENCE,
  parseThemePreference,
  resolvesToDark,
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  type ThemePreference,
} from "@/constants/theme";

function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readThemePreferenceCookie(): ThemePreference {
  if (typeof document === "undefined") return DEFAULT_THEME_PREFERENCE;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${THEME_COOKIE_NAME}=([^;]*)`),
  );
  return parseThemePreference(match ? decodeURIComponent(match[1]) : undefined);
}

/**
 * Applies a preference to the document and persists it.
 *
 * `colorScheme` is set alongside the class so native controls, scrollbars, and
 * form widgets follow the theme too — CSS variables alone do not reach them.
 */
export function applyThemePreference(preference: ThemePreference) {
  if (typeof document === "undefined") return;
  // biome-ignore lint/suspicious/noDocumentCookie: non-sensitive UI preference cookie read by the server layout, matching the sidebar_state pattern; the Cookie Store API is async and not available in every target browser.
  document.cookie = `${THEME_COOKIE_NAME}=${preference}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
  const isDark = resolvesToDark(preference, systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
}

/**
 * The theme actually being rendered, kept in sync with both the document class
 * and — when the preference is `"system"` — live OS changes.
 *
 * Starts as `"light"` so server and first client render agree; the real value
 * lands in the effect. The pre-paint script in `constants/theme.ts` has already
 * set the class by then, so this never causes a visible flash.
 */
export function useResolvedTheme(): "light" | "dark" {
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const sync = () =>
      setResolved(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
    sync();

    // Track the class directly, so any path that changes the theme — the
    // settings control, the pre-paint script, a future surface — is picked up.
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Follow the OS while the preference is "system".
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (readThemePreferenceCookie() !== "system") return;
      applyThemePreference("system");
    };
    query.addEventListener("change", onSystemChange);

    return () => {
      observer.disconnect();
      query.removeEventListener("change", onSystemChange);
    };
  }, []);

  return resolved;
}

export function useThemePreference(initial: ThemePreference) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initial);
  const resolved = useResolvedTheme();

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    applyThemePreference(next);
  }, []);

  return { preference, resolved, setPreference };
}
