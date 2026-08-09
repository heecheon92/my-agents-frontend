"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggler } from "@/components/ui/theme-toggler";
import type { ThemePreference } from "@/constants/theme";
import { useThemePreference } from "@/hooks/use-theme";
import { useLocalization } from "@/hooks/useLocalization";

/** system → light → dark → system */
const NEXT_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const ICONS = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
} as const;

export function ThemeTogglerButton({
  initialPreference,
}: {
  initialPreference: ThemePreference;
}) {
  const { localization } = useLocalization(
    (state) => state.localization.settings.appearance,
  );
  const { preference, resolved, setPreference } =
    useThemePreference(initialPreference);
  const Icon = ICONS[preference];
  const nextPreference = NEXT_PREFERENCE[preference];

  return (
    <ThemeToggler resolvedTheme={resolved} setTheme={setPreference}>
      {({ toggleTheme }) => (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => toggleTheme(nextPreference)}
          // The icon alone cannot convey which mode is active, so the
          // accessible name names both the current mode and what comes next.
          aria-label={localization.toggleLabel
            .replace("{current}", localization.themeOptions[preference])
            .replace("{next}", localization.themeOptions[nextPreference])}
          title={localization.themeOptions[preference]}
        >
          <Icon />
        </Button>
      )}
    </ThemeToggler>
  );
}
