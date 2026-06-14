"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ONBOARDING_WAIT_TIMEOUT_MS,
  getStepByIndex,
  type OnboardingStep,
  stepsForFlow,
} from "./onboarding-steps";
import { useOnboardingStore } from "./onboarding-store";

type OnboardingRouteAction =
  | { type: "none" }
  | { type: "navigate"; path: string }
  | { type: "cancel" };

export function resolveOnboardingRouteAction({
  isActive,
  pathname,
  previousStepKey,
  step,
  stepKey,
}: {
  isActive: boolean;
  pathname: string;
  previousStepKey: string | null;
  step?: OnboardingStep;
  stepKey: string | null;
}): OnboardingRouteAction {
  if (!isActive || !step || !stepKey) return { type: "none" };
  if (pathname === step.path) return { type: "none" };
  if (previousStepKey !== stepKey) {
    return { type: "navigate", path: step.path };
  }
  return { type: "cancel" };
}

export function useOnboardingRouteStep(identityBucket?: string) {
  const pathname = usePathname();
  const router = useRouter();
  const activeFlow = useOnboardingStore((state) => state.activeFlow);
  const activeStepIndex = useOnboardingStore((state) => state.activeStepIndex);
  const status = useOnboardingStore((state) => state.status);
  const targets = useOnboardingStore((state) => state.targets);
  const skip = useOnboardingStore((state) => state.skip);
  const previousStepKeyRef = useRef<string | null>(null);
  const [timedOutStepKey, setTimedOutStepKey] = useState<string | null>(null);
  const [usesMobileTargets, setUsesMobileTargets] = useState(false);

  const steps = useMemo(
    () => (activeFlow ? stepsForFlow(activeFlow) : []),
    [activeFlow],
  );
  const step = activeFlow
    ? getStepByIndex(activeFlow, activeStepIndex)
    : undefined;
  const stepKey = step ? `${step.flow}:${step.id}:${activeStepIndex}` : null;
  const targetId =
    usesMobileTargets && step?.mobileTargetId
      ? step.mobileTargetId
      : step?.targetId;
  const targetElement = targetId ? targets[targetId] : undefined;
  const isActive = status === "active" && Boolean(step);
  const shouldFallback = Boolean(
    isActive && stepKey && timedOutStepKey === stepKey && !targetElement,
  );
  const isTargetPending = Boolean(
    isActive &&
      (!step || pathname !== step.path || (!targetElement && !shouldFallback)),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateTargetMode = () => setUsesMobileTargets(mediaQuery.matches);
    updateTargetMode();
    mediaQuery.addEventListener("change", updateTargetMode);
    return () => mediaQuery.removeEventListener("change", updateTargetMode);
  }, []);

  useEffect(() => {
    if (!isActive || !step) return;
    setTimedOutStepKey(null);
  }, [isActive, step]);

  useEffect(() => {
    if (!isActive || !step || !stepKey) {
      previousStepKeyRef.current = null;
      return;
    }
    const action = resolveOnboardingRouteAction({
      isActive,
      pathname,
      previousStepKey: previousStepKeyRef.current,
      step,
      stepKey,
    });
    previousStepKeyRef.current = stepKey;

    if (action.type === "navigate") {
      router.push(action.path);
      return;
    }
    if (action.type === "cancel") {
      skip(identityBucket);
    }
  }, [identityBucket, isActive, pathname, router, skip, step, stepKey]);

  useEffect(() => {
    if (!isActive || !step || !stepKey) return;
    if (pathname !== step.path || targetElement) return;
    const timeoutId = window.setTimeout(() => {
      setTimedOutStepKey(stepKey);
    }, step.waitTimeoutMs ?? DEFAULT_ONBOARDING_WAIT_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isActive, pathname, step, stepKey, targetElement]);

  useEffect(() => {
    if (!targetElement || !isActive) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    targetElement.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [isActive, targetElement]);

  return {
    activeFlow,
    steps,
    step,
    targetElement,
    shouldFallback,
    isTargetPending,
  };
}
