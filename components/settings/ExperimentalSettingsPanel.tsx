"use client";

import { ErrorState } from "@/components/Status";
import { Switch } from "@/components/ui/switch";
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
      maxWidthClassName="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="cal-card rounded-xl p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-xl font-semibold text-cal-ink">
                  {copy.experimental.memoryTitle}
                </h2>
                <span className="rounded-full border border-cal-warning/25 bg-cal-warning/10 px-2.5 py-0.5 text-xs font-semibold text-cal-warning">
                  {copy.experimental.warningEyebrow}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-cal-muted">
                {copy.experimental.memoryDescription}
              </p>
              <p className="mt-2 text-xs leading-5 text-cal-muted">
                {copy.experimental.toggleHint}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 self-start sm:self-center">
              <span
                className={cn(
                  "text-sm font-semibold",
                  memoryEnabled ? "text-cal-success" : "text-cal-muted",
                )}
              >
                {settings.isLoading
                  ? copy.experimental.loadingStatus
                  : memoryEnabled
                    ? copy.experimental.enabledStatus
                    : copy.experimental.disabledStatus}
              </span>
              <Switch
                aria-label={copy.experimental.memoryTitle}
                checked={memoryEnabled}
                onCheckedChange={handleToggle}
                disabled={isBusy || Boolean(settings.error)}
              />
            </div>
          </div>
        </div>

        {settings.error ? (
          <ErrorState
            title={copy.experimental.loadErrorTitle}
            error={settings.error}
          />
        ) : null}
        {updateSettings.error ? (
          <ErrorState
            title={copy.experimental.updateErrorTitle}
            error={updateSettings.error}
          />
        ) : null}

        {isBusy ? (
          <p className="text-sm leading-6 text-cal-muted">
            {localization.auth.working}
          </p>
        ) : null}
      </div>
    </SettingsPageShell>
  );
}
