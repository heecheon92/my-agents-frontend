export type Rect = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };

export type CardPlacement =
  | { mode: "dock"; edge: "top" | "bottom" }
  | { mode: "float"; top: number; left: number };

const GAP = 12;
const MARGIN = 16;
/** Below `sm`, there is no room beside a target; the card docks to an edge. */
export const DOCK_BREAKPOINT = 640;

/**
 * Where the step card goes so it never covers what it is pointing at.
 *
 * The card used to sit in the bottom-right corner on every step, which put it
 * directly on top of the composer — the target of two steps — and its send
 * button. Placement now follows the target: below it, else above, else beside
 * it, and only falls back to a corner when the target fills the screen.
 *
 * On narrow screens there is no room beside anything, so the card docks to the
 * edge farther from the target instead of floating.
 */
export function placeOnboardingCard(
  target: Rect,
  viewport: Size,
  card: Size,
): CardPlacement {
  if (viewport.width < DOCK_BREAKPOINT) {
    const targetCenter = target.top + target.height / 2;
    return {
      mode: "dock",
      edge: targetCenter > viewport.height / 2 ? "top" : "bottom",
    };
  }

  const clampLeft = (left: number) =>
    Math.min(
      Math.max(MARGIN, left),
      Math.max(MARGIN, viewport.width - MARGIN - card.width),
    );
  const clampTop = (top: number) =>
    Math.min(
      Math.max(MARGIN, top),
      Math.max(MARGIN, viewport.height - MARGIN - card.height),
    );

  const below = target.top + target.height + GAP;
  if (below + card.height <= viewport.height - MARGIN) {
    return { mode: "float", top: below, left: clampLeft(target.left) };
  }
  const above = target.top - GAP - card.height;
  if (above >= MARGIN) {
    return { mode: "float", top: above, left: clampLeft(target.left) };
  }
  const right = target.left + target.width + GAP;
  if (right + card.width <= viewport.width - MARGIN) {
    return { mode: "float", top: clampTop(target.top), left: right };
  }
  const left = target.left - GAP - card.width;
  if (left >= MARGIN) {
    return { mode: "float", top: clampTop(target.top), left };
  }
  return {
    mode: "float",
    top: viewport.height - MARGIN - card.height,
    left: viewport.width - MARGIN - card.width,
  };
}

/**
 * A registered target can exist and still be invisible: the knowledge-base tree
 * lives in a sidebar that is `display: none` below `lg`. Measuring it gave a
 * 0×0 rect at the origin, and the spotlight's minimum size then drew a ring
 * around whatever happened to sit in the top-left corner (the menu button).
 */
export function isRenderedTarget(element: HTMLElement | undefined) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
