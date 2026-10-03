"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import {
  type CardPlacement,
  placeOnboardingCard,
  type Size,
} from "./onboarding-placement";
import { useOnboardingStore } from "./onboarding-store";
import { useOnboardingRouteStep } from "./useOnboardingRouteStep";

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function measure(element?: HTMLElement): TargetRect | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export function OnboardingOverlay({
  identityBucket,
}: {
  identityBucket?: string;
}) {
  const { localization } = useLocalization(
    (state) => state.localization.onboarding,
  );
  const status = useOnboardingStore((state) => state.status);
  const activeStepIndex = useOnboardingStore((state) => state.activeStepIndex);
  const next = useOnboardingStore((state) => state.next);
  const back = useOnboardingStore((state) => state.back);
  const skip = useOnboardingStore((state) => state.skip);
  const complete = useOnboardingStore((state) => state.complete);
  const { steps, step, targetElement, shouldFallback, isTargetPending } =
    useOnboardingRouteStep(identityBucket);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [viewport, setViewport] = useState<Size | null>(null);
  const [cardSize, setCardSize] = useState<Size | null>(null);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isOpen = status === "active" && Boolean(step) && !isTargetPending;
  const isLast = activeStepIndex + 1 >= steps.length;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    window.setTimeout(() => cardRef.current?.focus(), 0);
    return () => previousFocusRef.current?.focus?.();
  }, [isOpen]);

  // The card is keyed by step so each one animates in, which also means the
  // button that advanced the tour unmounts. Move focus to the new card so
  // keyboard and screen-reader users land on the step that just opened.
  const stepId = step?.id;
  useEffect(() => {
    if (!isOpen || !stepId) return;
    cardRef.current?.focus();
  }, [isOpen, stepId]);

  useEffect(() => {
    if (!isOpen) return;
    let animationFrameId: number | null = null;
    const update = () => {
      if (animationFrameId !== null) return;
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        setTargetRect(measure(targetElement));
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    setTargetRect(measure(targetElement));
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (targetElement) observer?.observe(targetElement);
    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer?.disconnect();
    };
  }, [isOpen, targetElement]);

  // Measured before paint so the card never flashes at a provisional spot.
  // Observed as well, because copy length differs per step and per language.
  useLayoutEffect(() => {
    // `stepId` is read so the effect reruns per step: the card is keyed by
    // step, so each step mounts a new element to observe.
    const card = cardRef.current;
    if (!isOpen || !stepId || !card) return;
    const read = () =>
      setCardSize({ width: card.offsetWidth, height: card.offsetHeight });
    read();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    observer?.observe(card);
    return () => observer?.disconnect();
  }, [isOpen, stepId]);

  useEffect(() => {
    if (!isOpen) return;
    const appElements = Array.from(document.body.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        element.dataset.onboardingOverlay !== "true",
    );
    const previousState = appElements.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.inert,
    }));
    for (const element of appElements) {
      element.setAttribute("aria-hidden", "true");
      element.inert = true;
    }
    return () => {
      for (const { element, ariaHidden, inert } of previousState) {
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
        element.inert = inert;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        skip(identityBucket);
        return;
      }
      if (event.key !== "Tab" || !cardRef.current) return;

      const focusableElements = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [identityBucket, isOpen, skip]);

  const spotlightStyle = useMemo(() => {
    if (!targetRect || shouldFallback) return undefined;
    return {
      top: Math.max(8, targetRect.top - 8),
      left: Math.max(8, targetRect.left - 8),
      width: Math.max(48, targetRect.width + 16),
      height: Math.max(48, targetRect.height + 16),
    };
  }, [shouldFallback, targetRect]);

  const placement = useMemo<CardPlacement | null>(() => {
    if (!spotlightStyle || !viewport || !cardSize) return null;
    return placeOnboardingCard(spotlightStyle, viewport, cardSize);
  }, [cardSize, spotlightStyle, viewport]);

  if (!mounted || !isOpen || !step) return null;

  const stepsCopy = localization.steps as Record<string, string>;
  const title = stepsCopy[step.titleKey] ?? step.titleKey;
  const body = stepsCopy[step.bodyKey] ?? step.bodyKey;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000]"
      aria-live="polite"
      data-onboarding-overlay="true"
    >
      {spotlightStyle ? (
        // The ring's own shadow is the only dimming layer. A separate
        // full-screen scrim used to sit underneath it as well, so the
        // highlighted control was darkened like everything else and the
        // "spotlight" was only an outline.
        <div
          data-onboarding-spotlight="true"
          className="pointer-events-none absolute rounded-2xl border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.5)] transition-[top,left,width,height] duration-[var(--duration-panel)] ease-[var(--ease-standard)]"
          style={spotlightStyle}
        />
      ) : (
        <div className="absolute inset-0 bg-black/50" />
      )}
      <div
        className={cn(
          "absolute inset-0 p-4 sm:p-6",
          !spotlightStyle && "grid place-items-center",
        )}
      >
        <div
          key={step.id}
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          aria-describedby="onboarding-body"
          tabIndex={-1}
          style={
            placement?.mode === "float"
              ? { top: placement.top, left: placement.left }
              : undefined
          }
          className={cn(
            "cal-card w-full max-w-sm rounded-2xl p-4 shadow-2xl outline-none",
            "animate-in fade-in zoom-in-95 duration-[var(--duration-panel)]",
            spotlightStyle && "absolute",
            // Hidden only for the single layout pass before the card's own
            // size is known; placement needs it.
            spotlightStyle && !placement && "invisible",
            placement?.mode === "dock" && "inset-x-4 w-auto max-w-none",
            placement?.mode === "dock" &&
              placement.edge === "top" &&
              "top-[calc(env(safe-area-inset-top)+1rem)]",
            placement?.mode === "dock" &&
              placement.edge === "bottom" &&
              "bottom-[calc(env(safe-area-inset-bottom)+1rem)]",
          )}
        >
          <p className="cal-label">{localization.eyebrow}</p>
          <h2
            id="onboarding-title"
            className="mt-2 text-lg font-semibold text-cal-ink"
          >
            {title}
          </h2>
          <p
            id="onboarding-body"
            className="mt-2 text-sm leading-6 text-cal-body"
          >
            {body}
          </p>
          {shouldFallback ? (
            <p className="mt-2 text-xs leading-5 text-cal-muted">
              {localization.targetFallback}
            </p>
          ) : null}
          <p className="mt-3 text-xs font-medium text-cal-muted">
            {localization.progress
              .replace("{current}", String(activeStepIndex + 1))
              .replace("{total}", String(steps.length))}
          </p>
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => skip(identityBucket)}
            >
              {localization.skip}
            </Button>
            <div className="flex gap-2">
              {activeStepIndex > 0 ? (
                <Button type="button" variant="secondary" onClick={back}>
                  {localization.back}
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => {
                  if (isLast) complete(identityBucket);
                  else next(steps.length);
                }}
              >
                {isLast ? localization.done : localization.next}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
