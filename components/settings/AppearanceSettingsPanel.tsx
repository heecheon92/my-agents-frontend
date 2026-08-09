"use client";

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { THEME_PREFERENCES, type ThemePreference } from "@/constants/theme";
import { useThemePreference } from "@/hooks/use-theme";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import { SettingsPageShell } from "./SettingsPageShell";

const OPTION_ICONS = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
} as const satisfies Record<
  ThemePreference,
  React.ComponentType<{ className?: string }>
>;

export function AppearanceSettingsPanel({
  initialPreference,
}: {
  initialPreference: ThemePreference;
}) {
  const { localization } = useLocalization((state) => state.localization);
  const copy = localization.settings;
  const { preference, resolved, setPreference } =
    useThemePreference(initialPreference);

  return (
    <SettingsPageShell
      eyebrow={copy.eyebrow}
      title={copy.appearance.title}
      description={copy.appearance.description}
      accountTab={copy.tabs.account}
      appearanceTab={copy.tabs.appearance}
      experimentalTab={copy.tabs.experimental}
    >
      <section className="cal-card rounded-xl p-5">
        <h2 className="font-heading text-xl font-semibold text-cal-ink">
          {copy.appearance.themeTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-cal-muted">
          {copy.appearance.themeDescription}
        </p>

        <fieldset className="mt-5">
          <legend className="sr-only">{copy.appearance.themeTitle}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEME_PREFERENCES.map((option) => {
              const Icon = OPTION_ICONS[option];
              const isSelected = preference === option;
              return (
                <label
                  key={option}
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-2 rounded-control border p-4 transition-colors",
                    "focus-within:border-km-accent focus-within:ring-3 focus-within:ring-km-accent/20",
                    isSelected
                      ? "border-cal-primary bg-cal-surface-soft"
                      : "border-cal-hairline bg-cal-canvas hover:border-cal-primary/40",
                  )}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={option}
                    checked={isSelected}
                    onChange={() => setPreference(option)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between">
                    <Icon className="size-5 text-cal-ink" />
                    {isSelected ? (
                      <CheckIcon className="size-4 text-cal-primary" />
                    ) : null}
                  </span>
                  <span className="text-sm font-semibold text-cal-ink">
                    {copy.appearance.themeOptions[option]}
                  </span>
                  <span className="text-xs leading-5 text-cal-muted">
                    {copy.appearance.themeOptionHints[option]}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <p aria-live="polite" className="mt-4 text-sm text-cal-muted">
          {copy.appearance.currentThemeLabel.replace(
            "{theme}",
            copy.appearance.resolvedThemes[resolved],
          )}
        </p>
      </section>
    </SettingsPageShell>
  );
}
