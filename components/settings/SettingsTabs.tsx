"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";

type SettingsTabsProps = {
  accountLabel: string;
  appearanceLabel: string;
  experimentalLabel: string;
};

const settingsTabs = [
  { href: "/settings/account", key: "account" },
  { href: "/settings/appearance", key: "appearance" },
  { href: "/settings/experimental", key: "experimental" },
] as const;

export function SettingsTabs({
  accountLabel,
  appearanceLabel,
  experimentalLabel,
}: SettingsTabsProps) {
  const pathname = usePathname();
  const { localization } = useLocalization(
    (state) => state.localization.settings,
  );
  const labels = {
    account: accountLabel,
    appearance: appearanceLabel,
    experimental: experimentalLabel,
  } as const;

  return (
    <nav
      aria-label={localization.sectionsLabel}
      className="flex flex-wrap gap-2 rounded-xl border border-cal-hairline bg-cal-surface-soft p-1"
    >
      {settingsTabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold text-cal-muted transition-colors hover:bg-cal-surface-soft hover:text-cal-ink",
              isActive &&
                "bg-cal-primary text-white hover:bg-cal-primary hover:text-white",
            )}
          >
            {labels[tab.key]}
          </Link>
        );
      })}
    </nav>
  );
}
