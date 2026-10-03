import { describe, expect, it } from "vitest";
import {
  isRenderedTarget,
  placeOnboardingCard,
} from "@/components/onboarding/onboarding-placement";

const desktop = { width: 1440, height: 900 };
const card = { width: 384, height: 230 };

describe("placeOnboardingCard", () => {
  it("puts the card below a target when it fits", () => {
    const target = { top: 100, left: 300, width: 200, height: 40 };
    expect(placeOnboardingCard(target, desktop, card)).toEqual({
      mode: "float",
      top: 152,
      left: 300,
    });
  });

  it("goes above a bottom target such as the composer instead of covering it", () => {
    // The old fixed bottom-right corner sat on top of this target.
    const composer = { top: 718, left: 314, width: 1100, height: 156 };
    const placement = placeOnboardingCard(composer, desktop, card);
    expect(placement).toEqual({ mode: "float", top: 476, left: 314 });
  });

  it("sits beside a target too tall for above or below", () => {
    const tree = { top: 137, left: 313, width: 335, height: 738 };
    expect(placeOnboardingCard(tree, desktop, card)).toEqual({
      mode: "float",
      top: 137,
      left: 660,
    });
  });

  it("keeps the card inside the viewport when the target is near an edge", () => {
    const target = { top: 100, left: 1300, width: 120, height: 40 };
    const placement = placeOnboardingCard(target, desktop, card);
    expect(placement).toEqual({ mode: "float", top: 152, left: 1040 });
  });

  it("falls back to the corner only when the target fills the screen", () => {
    const fullScreen = { top: 8, left: 8, width: 1424, height: 884 };
    expect(placeOnboardingCard(fullScreen, desktop, card)).toEqual({
      mode: "float",
      top: 654,
      left: 1040,
    });
  });

  it("docks to the edge farther from the target on narrow screens", () => {
    const phone = { width: 390, height: 844 };
    const nearBottom = { top: 690, left: 8, width: 374, height: 146 };
    const nearTop = { top: 320, left: 24, width: 136, height: 56 };
    expect(placeOnboardingCard(nearBottom, phone, card)).toEqual({
      mode: "dock",
      edge: "top",
    });
    expect(placeOnboardingCard(nearTop, phone, card)).toEqual({
      mode: "dock",
      edge: "bottom",
    });
  });
});

describe("isRenderedTarget", () => {
  const element = (width: number, height: number) =>
    ({
      getBoundingClientRect: () => ({ width, height }),
    }) as unknown as HTMLElement;

  it("rejects a registered target that is hidden by layout", () => {
    // `display: none` measures 0×0; the spotlight then ringed the menu button.
    expect(isRenderedTarget(element(0, 0))).toBe(false);
    expect(isRenderedTarget(undefined)).toBe(false);
  });

  it("accepts a target with a real size", () => {
    expect(isRenderedTarget(element(120, 40))).toBe(true);
  });
});
