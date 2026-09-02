"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * A wave that ripples through the text, one character at a time.
 *
 * Each character cycles between two colours on shared keyframes, offset by its
 * position; that stagger is what makes the highlight travel rather than pulse.
 * `wave` adds the optional lift, scale, and tilt as the crest passes.
 *
 * The two colours come from CSS custom properties, so the wave follows the
 * theme instead of hard-coding a palette. They are declared on the wrapper and
 * read per character, which also means one place to retint the effect.
 *
 * Both colour keyframes start and end at the resting value, so a paused
 * animation is the ordinary row rather than an arbitrary mid-sweep frame.
 * Contrast only ever rises during the pass — a fade-to-background shimmer
 * cannot promise that on 12px Korean.
 *
 * Three structural details are load-bearing:
 *
 * Splitting happens per word, and each word is `whitespace-nowrap` **inline** —
 * per-character spans alone let the browser break a latin word anywhere
 * ("Annota / ted"), and making each word atomic with `inline-block` silently
 * defeats `line-clamp`, which has already happened on this row once.
 *
 * Characters become `inline-block` only in `wave` mode. Transforms do not apply
 * to non-replaced inline boxes, so the lift needs it — but it subtly changes
 * line box metrics, so the default colour-only mode does not pay that cost.
 *
 * Only the leading characters animate. Two clamped lines hold well under 200
 * characters at any supported width and the rest is clipped, so animating a
 * 500-character summary in full would mount hundreds of nodes nobody can see,
 * on a surface that already re-renders on every answer delta.
 */
const ANIMATED_CHARACTER_BUDGET = 200;
/*
 * These three are one setting, not three.
 *
 * The crest is deliberately a short flash — `CREST_TIMES` keeps a character at
 * full brightness for under a third of the cycle and resting for the rest — so
 * that only a band of characters is lit at any instant and the band reads as
 * something moving. A smooth half-cycle fade instead lights nearly everything
 * at once, and a first attempt did exactly that: with the stagger spreading a
 * full period across a typical line, the whole row simply dimmed and brightened
 * together, which is not a shimmer.
 *
 * Band width in characters is roughly `(lit fraction × duration) / stagger`,
 * about fourteen here. Shortening the stagger widens the band until it swallows
 * the line; lengthening it breaks the band into separate blinking characters.
 */
const STAGGER_SECONDS = 0.03;
const DURATION_SECONDS = 1.5;
const CREST_TIMES = [0, 0.1, 0.28, 1];

export function ShimmerText({
  text,
  wave = false,
}: {
  text: string;
  /** Adds the reference's subtle lift, scale, and tilt behind the crest. */
  wave?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  let characterIndex = 0;

  return (
    <span
      style={
        {
          "--km-shimmer-base": "var(--cal-muted)",
          "--km-shimmer-crest": "var(--cal-ink)",
          // Without a perspective, `rotateX` is an orthographic squash rather
          // than a tilt: the glyph just gets shorter. Shallow on purpose — a
          // strong perspective on 12px text reads as distortion.
          ...(wave ? { perspective: "480px" } : {}),
        } as React.CSSProperties
      }
    >
      {text.split(/(\s+)/).map((word, wordIndex) => {
        if (!word.trim()) return word;
        const start = characterIndex;
        characterIndex += word.length;
        // Past the budget the text is clipped anyway, so it stays a plain node.
        if (start >= ANIMATED_CHARACTER_BUDGET || prefersReducedMotion) {
          return word;
        }
        return (
          <span
            // Splitting is positional, so position is the identity.
            key={`${wordIndex}-${word}`}
            className="whitespace-nowrap"
          >
            {[...word].map((character, offset) => (
              <motion.span
                key={`${offset}-${character}`}
                className={wave ? "inline-block" : undefined}
                animate={{
                  color: [
                    "var(--km-shimmer-base)",
                    "var(--km-shimmer-crest)",
                    "var(--km-shimmer-base)",
                    "var(--km-shimmer-base)",
                  ],
                  ...(wave
                    ? {
                        y: [0, -2, 0, 0],
                        scale: [1, 1.06, 1, 1],
                        rotateX: [0, 14, 0, 0],
                      }
                    : {}),
                }}
                transition={{
                  duration: DURATION_SECONDS,
                  times: CREST_TIMES,
                  delay: (start + offset) * STAGGER_SECONDS,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              >
                {character}
              </motion.span>
            ))}
          </span>
        );
      })}
    </span>
  );
}
