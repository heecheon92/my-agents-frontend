"use client";

import { Button } from "@/components/ui/button";
import type { ChatLocalization } from "../types";

/**
 * What renders when this build cannot draw the interaction it was handed.
 *
 * This is not a nicety. The run behind an interaction is suspended, and a
 * suspended run blocks every further message in that conversation until it is
 * answered, cancelled, or expires — 24 hours later by backend default. Failing
 * to render *anything* would leave the user with a composer that silently
 * refuses to send and no way to find out why. So the dead end is visible and
 * always offers cancel.
 */
export function UnsupportedInteractionCard({
  reason,
  localization,
  onCancel,
}: {
  /**
   * `unsupported_version` means the backend moved ahead of this build and
   * reloading may genuinely fix it. `unsupported_type` means it will not — the
   * remedies differ, so the copy does too.
   */
  reason: "unsupported_type" | "unsupported_version";
  localization: ChatLocalization;
  onCancel: () => void;
}) {
  return (
    <div
      data-slot="interaction-card"
      data-unsupported={reason}
      className="mb-3 rounded-xl border border-cal-hairline bg-cal-surface-soft p-3 text-sm text-cal-body"
    >
      <p className="font-semibold text-cal-ink">
        {localization.interactionUnsupportedTitle}
      </p>
      <p className="mt-1">
        {reason === "unsupported_version"
          ? localization.interactionUnsupportedVersionDescription
          : localization.interactionUnsupportedTypeDescription}
      </p>
      <div className="mt-3">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          {localization.interactionCancel}
        </Button>
      </div>
    </div>
  );
}
