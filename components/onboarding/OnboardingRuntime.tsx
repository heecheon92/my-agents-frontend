"use client";

import { useEffect, useMemo } from "react";
import type { User } from "@/model/my-agents";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { OnboardingPrompt } from "./OnboardingPrompt";
import type { OnboardingFlow } from "./onboarding-steps";
import {
  getGuestSessionDecision,
  opaqueIdentityBucket,
  useOnboardingStore,
} from "./onboarding-store";

type OnboardingIdentity = {
  flow: OnboardingFlow | null;
  bucket?: string;
  shouldPrompt: boolean;
};

export function useOnboardingIdentity(user?: User): OnboardingIdentity {
  return useMemo(() => {
    if (!user) return { flow: null, bucket: undefined, shouldPrompt: false };
    if (user.is_guest) {
      const flow: OnboardingFlow = "guest";
      return {
        flow,
        bucket: "guest:session",
        shouldPrompt: !getGuestSessionDecision(flow),
      };
    }

    return {
      flow: "new-user",
      bucket: opaqueIdentityBucket(user.id),
      shouldPrompt: true,
    };
  }, [user]);
}

export function OnboardingRuntime({ user }: { user?: User }) {
  const status = useOnboardingStore((state) => state.status);
  const isHydrated = useOnboardingStore((state) => state.isHydrated);
  const authDecisions = useOnboardingStore((state) => state.authDecisions);
  const prompt = useOnboardingStore((state) => state.prompt);
  const { flow, bucket, shouldPrompt } = useOnboardingIdentity(user);

  const authDecision =
    bucket && flow ? authDecisions[bucket]?.[flow] : undefined;
  const shouldShowPrompt =
    isHydrated &&
    status === "idle" &&
    Boolean(flow) &&
    shouldPrompt &&
    !authDecision?.completed &&
    !authDecision?.dismissed;

  useEffect(() => {
    if (!shouldShowPrompt || !flow) return;
    prompt(flow);
  }, [flow, prompt, shouldShowPrompt]);

  if (!flow || !bucket || !isHydrated) return null;

  return (
    <>
      {status === "prompt" ? (
        <div className="fixed top-[calc(env(safe-area-inset-top)+1rem)] right-4 z-[900] w-[min(24rem,calc(100vw-2rem))]">
          <OnboardingPrompt flow={flow} identityBucket={bucket} />
        </div>
      ) : null}
      <OnboardingOverlay identityBucket={bucket} />
    </>
  );
}
