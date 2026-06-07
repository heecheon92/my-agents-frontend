"use client";

import { Button } from "@/components/ui/button";
import { useLocalization } from "@/hooks/useLocalization";
import type { OnboardingFlow } from "./onboarding-steps";
import { useOnboardingStore } from "./onboarding-store";

export function OnboardingPrompt({
  flow,
  identityBucket,
}: {
  flow: OnboardingFlow;
  identityBucket?: string;
}) {
  const { localization } = useLocalization(
    (state) => state.localization.onboarding,
  );
  const start = useOnboardingStore((state) => state.start);
  const skip = useOnboardingStore((state) => state.skip);

  return (
    <section
      className="cal-card rounded-xl p-4 shadow-lg"
      aria-label={localization.promptEyebrow}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cal-muted">
        {localization.promptEyebrow}
      </p>
      <p className="mt-1 text-sm font-semibold text-cal-ink">
        {flow === "guest"
          ? localization.guestPromptTitle
          : localization.newUserPromptTitle}
      </p>
      <p className="mt-1 text-xs leading-5 text-cal-muted">
        {flow === "guest"
          ? localization.guestPromptBody
          : localization.newUserPromptBody}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => start(flow)}>
          {localization.start}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => skip(identityBucket)}
        >
          {localization.notNow}
        </Button>
      </div>
    </section>
  );
}
