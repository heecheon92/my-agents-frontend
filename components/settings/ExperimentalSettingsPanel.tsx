"use client";

import { ErrorState } from "@/components/Status";
import { Button } from "@/components/ui/button";
import {
  useMemorySettings,
  useUpdateMemorySettings,
} from "@/hooks/use-memory-settings";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import { SettingsPageShell } from "./SettingsPageShell";

export function ExperimentalSettingsPanel() {
  const settings = useMemorySettings();
  const updateSettings = useUpdateMemorySettings();
  const { localization } = useLocalization((state) => ({
    settings: state.localization.settings,
    auth: state.localization.auth,
  }));
  const copy = localization.settings;
  const memoryEnabled = Boolean(settings.data?.enabled);
  const isBusy = settings.isLoading || updateSettings.isPending;

  async function handleToggle() {
    try {
      await updateSettings.mutateAsync({ enabled: !memoryEnabled });
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <SettingsPageShell
      eyebrow={copy.eyebrow}
      title={copy.experimental.title}
      description={copy.experimental.description}
      accountTab={copy.tabs.account}
      experimentalTab={copy.tabs.experimental}
    >
      <div className="cal-card max-w-3xl rounded-xl p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cal-warning">
              {copy.experimental.warningEyebrow}
            </p>
            <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.03em] text-cal-ink">
              {copy.experimental.memoryTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-cal-muted">
              {copy.experimental.memoryDescription}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex rounded-full border px-3 py-1 text-sm font-semibold",
              memoryEnabled
                ? "border-cal-success/25 bg-cal-success/10 text-cal-success"
                : "border-cal-hairline bg-cal-surface-soft text-cal-muted",
            )}
          >
            {settings.isLoading
              ? copy.experimental.loadingStatus
              : memoryEnabled
                ? copy.experimental.enabledStatus
                : copy.experimental.disabledStatus}
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-cal-hairline bg-cal-surface-soft p-4 text-sm leading-6 text-cal-muted">
          <p className="font-semibold text-cal-ink">
            {copy.experimental.privacyTitle}
          </p>
          <p className="mt-2">{copy.experimental.privacyDescription}</p>
        </div>

        {settings.error ? (
          <div className="mt-5">
            <ErrorState
              title={copy.experimental.loadErrorTitle}
              error={settings.error}
            />
          </div>
        ) : null}
        {updateSettings.error ? (
          <div className="mt-5">
            <ErrorState
              title={copy.experimental.updateErrorTitle}
              error={updateSettings.error}
            />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            onClick={handleToggle}
            disabled={isBusy || Boolean(settings.error)}
          >
            {isBusy
              ? localization.auth.working
              : memoryEnabled
                ? copy.experimental.disableSubmit
                : copy.experimental.enableSubmit}
          </Button>
          <p className="text-sm leading-6 text-cal-muted">
            {copy.experimental.toggleHint}
          </p>
        </div>
      </div>
    </SettingsPageShell>
  );
}
