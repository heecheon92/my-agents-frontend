"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import type { ThemePreference } from "@/constants/theme";

/**
 * Animated theme transition, adapted from Animate UI's `theme-toggler` effect
 * primitive (https://animate-ui.com/docs/components/buttons/theme-toggler, MIT).
 *
 * Two deliberate changes from upstream:
 *
 *  - **No `next-themes`.** Upstream's button wrapper pulls it in, but the
 *    underlying effect is store-agnostic: it takes the current theme and a
 *    setter as props. This repo already resolves theme from a server-read
 *    cookie (`constants/theme.ts`), so wiring the effect to that keeps the
 *    animation and adds no dependency — which DESIGN.md requires.
 *  - **Respects `prefers-reduced-motion`.** Upstream always runs the wipe.
 *    DESIGN.md requires a reduced-motion fallback, so the theme still switches
 *    instantly for users who ask for less motion.
 *
 * Browsers without the View Transitions API get the same instant switch.
 */

export type ThemeTogglerDirection = "btt" | "ttb" | "ltr" | "rtl";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

const CLIP_KEYFRAMES: Record<ThemeTogglerDirection, [string, string]> = {
  ltr: ["inset(0 100% 0 0)", "inset(0 0 0 0)"],
  rtl: ["inset(0 0 0 100%)", "inset(0 0 0 0)"],
  ttb: ["inset(0 0 100% 0)", "inset(0 0 0 0)"],
  btt: ["inset(100% 0 0 0)", "inset(0 0 0 0)"],
};

/** Matches the panel-reveal timing in DESIGN.md rather than upstream's 700ms. */
const TRANSITION_DURATION_MS = 420;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type ThemeTogglerProps = {
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
  direction?: ThemeTogglerDirection;
  children: (state: {
    toggleTheme: (theme: ThemePreference) => void;
  }) => React.ReactNode;
};

export function ThemeToggler({
  resolvedTheme,
  setTheme,
  direction = "ltr",
  children,
}: ThemeTogglerProps) {
  const [fromClip, toClip] = CLIP_KEYFRAMES[direction];

  const toggleTheme = React.useCallback(
    async (nextTheme: ThemePreference) => {
      const nextResolved =
        nextTheme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : nextTheme;

      const doc = document as ViewTransitionDocument;

      // Nothing visual changes, or the user asked for less motion, or the
      // browser has no View Transitions: just set it.
      if (
        nextResolved === resolvedTheme ||
        prefersReducedMotion() ||
        !doc.startViewTransition
      ) {
        setTheme(nextTheme);
        return;
      }

      // `flushSync` forces the class change to paint inside the transition
      // capture, which is what gives the wipe something to reveal.
      await doc.startViewTransition(() => {
        flushSync(() => {
          document.documentElement.classList.toggle(
            "dark",
            nextResolved === "dark",
          );
        });
      }).ready;

      // Persist as soon as the transition has captured its "before" snapshot,
      // not when the animation finishes. Upstream defers this to `.finished`,
      // which loses the preference entirely if the user navigates or reloads
      // during the animation. It cannot run any earlier than this either: the
      // setter toggles the same class, so calling it before `startViewTransition`
      // would make the captured "old" frame identical to the new one and there
      // would be nothing to reveal.
      setTheme(nextTheme);

      document.documentElement.animate(
        { clipPath: [fromClip, toClip] },
        {
          duration: TRANSITION_DURATION_MS,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    },
    [resolvedTheme, setTheme, fromClip, toClip],
  );

  return (
    <>
      {children({ toggleTheme })}
      {/* The default cross-fade would fight the clip-path wipe. */}
      <style>{`::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal;}`}</style>
    </>
  );
}
