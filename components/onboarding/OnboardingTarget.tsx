"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { useOnboardingStore } from "./onboarding-store";

export function OnboardingTarget({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const registerTarget = useOnboardingStore((state) => state.registerTarget);
  const unregisterTarget = useOnboardingStore(
    (state) => state.unregisterTarget,
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    registerTarget(id, element);
    return () => unregisterTarget(id, element);
  }, [id, registerTarget, unregisterTarget]);

  return (
    <div ref={ref} className={className} data-onboarding-target={id}>
      {children}
    </div>
  );
}
