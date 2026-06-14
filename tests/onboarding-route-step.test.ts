import { describe, expect, it } from "vitest";
import { stepsForFlow } from "@/components/onboarding/onboarding-steps";
import { resolveOnboardingRouteAction } from "@/components/onboarding/useOnboardingRouteStep";

const firstNewUserStep = stepsForFlow("new-user")[0];

describe("onboarding route control", () => {
  it("auto-navigates when a newly active step lives on another route", () => {
    expect(
      resolveOnboardingRouteAction({
        isActive: true,
        pathname: "/chat",
        previousStepKey: null,
        step: firstNewUserStep,
        stepKey: "new-user:new-knowledge-space:0",
      }),
    ).toEqual({ type: "navigate", path: "/knowledge" });
  });

  it("cancels instead of redirecting when the user changes routes during the same step", () => {
    expect(
      resolveOnboardingRouteAction({
        isActive: true,
        pathname: "/settings/account",
        previousStepKey: "new-user:new-knowledge-space:0",
        step: firstNewUserStep,
        stepKey: "new-user:new-knowledge-space:0",
      }),
    ).toEqual({ type: "cancel" });
  });

  it("does nothing when the current route already matches the active step", () => {
    expect(
      resolveOnboardingRouteAction({
        isActive: true,
        pathname: "/knowledge",
        previousStepKey: "new-user:new-knowledge-space:0",
        step: firstNewUserStep,
        stepKey: "new-user:new-knowledge-space:0",
      }),
    ).toEqual({ type: "none" });
  });
});
