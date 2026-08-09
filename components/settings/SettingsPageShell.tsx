"use client";

import { cn } from "@/lib/utils";
import { SettingsTabs } from "./SettingsTabs";

type SettingsPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  accountTab: string;
  experimentalTab: string;
  children: React.ReactNode;
  maxWidthClassName?: string;
};

export function SettingsPageShell({
  eyebrow,
  title,
  description,
  accountTab,
  experimentalTab,
  children,
  maxWidthClassName = "max-w-5xl",
}: SettingsPageShellProps) {
  return (
    <section className={cn("mx-auto grid w-full gap-6", maxWidthClassName)}>
      <div className="grid gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cal-muted">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold text-cal-ink sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-cal-muted sm:text-base">
            {description}
          </p>
        </div>
        <SettingsTabs
          accountLabel={accountTab}
          experimentalLabel={experimentalTab}
        />
      </div>
      {children}
    </section>
  );
}
