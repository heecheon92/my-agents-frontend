import { describe, expect, it } from "vitest";
import { stepsForFlow } from "@/components/onboarding/onboarding-steps";
import {
  matchesStepPath,
  resolveOnboardingRouteAction,
} from "@/components/onboarding/useOnboardingRouteStep";

const firstNewUserStep = stepsForFlow("new-user")[0];
const chatStep = stepsForFlow("new-user").find((step) => step.path === "/chat");

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

  it("treats a resource route as its parent step route", () => {
    // `/chat/<id>` and `/knowledge/<id>` are the same step route as `/chat` and
    // `/knowledge`. Exact matching used to navigate away from the open
    // conversation, or cancel the tour outright.
    expect(matchesStepPath("/chat/abc", "/chat")).toBe(true);
    expect(matchesStepPath("/knowledge/xyz", "/knowledge")).toBe(true);
    expect(matchesStepPath("/chat", "/chat")).toBe(true);
  });

  it("does not treat a sibling route as a match", () => {
    expect(matchesStepPath("/chatter", "/chat")).toBe(false);
    expect(matchesStepPath("/settings/account", "/chat")).toBe(false);
  });

  it("stays put when the user is on a conversation under the step route", () => {
    if (!chatStep)
      throw new Error("expected a /chat step in the new-user flow");
    expect(
      resolveOnboardingRouteAction({
        isActive: true,
        pathname: "/chat/conversation-1",
        previousStepKey: null,
        step: chatStep,
        stepKey: "new-user:chat:0",
      }),
    ).toEqual({ type: "none" });
  });
});
