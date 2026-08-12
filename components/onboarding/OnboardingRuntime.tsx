"use client";

import { useEffect, useMemo } from "react";
import type { User } from "@/model/my-agents";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { OnboardingPrompt } from "./OnboardingPrompt";
import type { OnboardingFlow } from "./onboarding-steps";
import {
  GUEST_IDENTITY_BUCKET,
  opaqueIdentityBucket,
  useOnboardingStore,
} from "./onboarding-store";

type OnboardingIdentity = {
  flow: OnboardingFlow | null;
  bucket?: string;
};

/**
 * Resolves *who* is being onboarded, not whether to prompt them. The decision
 * itself is read reactively from the store — this memo is keyed on `user`,
 * which does not change when the user dismisses the tour, so anything decided
 * here would be frozen for the life of the session.
 */
export function useOnboardingIdentity(user?: User): OnboardingIdentity {
  return useMemo(() => {
    if (!user) return { flow: null, bucket: undefined };
    if (user.is_guest) {
      return { flow: "guest", bucket: GUEST_IDENTITY_BUCKET };
    }

    return { flow: "new-user", bucket: opaqueIdentityBucket(user.id) };
  }, [user]);
}

export function OnboardingRuntime({ user }: { user?: User }) {
  const status = useOnboardingStore((state) => state.status);
  const isHydrated = useOnboardingStore((state) => state.isHydrated);
  const authDecisions = useOnboardingStore((state) => state.authDecisions);
  const guestDecisions = useOnboardingStore((state) => state.guestDecisions);
  const prompt = useOnboardingStore((state) => state.prompt);
  const { flow, bucket } = useOnboardingIdentity(user);

  // One decision lookup for both identities. Guest decisions used to live only
  // in sessionStorage, which nothing subscribed to, so dismissing re-prompted
  // immediately: `skip()` set status back to "idle", this gate recomputed to
  // true, and the effect below re-opened the card.
  const decision = !flow
    ? undefined
    : bucket === GUEST_IDENTITY_BUCKET
      ? guestDecisions[flow]
      : bucket
        ? authDecisions[bucket]?.[flow]
        : undefined;
  const shouldShowPrompt =
    isHydrated &&
    status === "idle" &&
    Boolean(flow) &&
    !decision?.completed &&
    !decision?.dismissed;

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
