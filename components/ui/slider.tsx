"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

/**
 * A discrete, single-value slider.
 *
 * Wraps the Base UI primitive so feature code never imports `@base-ui/*`
 * directly, matching `components/ui/switch.tsx`. Keyboard interaction, the
 * `slider` role, and the `aria-valuenow`/`aria-valuetext` bookkeeping all come
 * from the primitive — do not reimplement them with div handlers.
 *
 * `ticks` renders a stop per allowed value. The thumb transition uses the
 * shared motion tokens, and the global `prefers-reduced-motion` block in
 * `app/globals.css` neutralises it, so no local opt-out is needed here.
 */
function Slider({
  className,
  ticks = 0,
  getAriaValueText,
  ...props
}: SliderPrimitive.Root.Props<number> & {
  ticks?: number;
  /** Forwarded to the Thumb, which owns `aria-valuetext`, not the Root. */
  getAriaValueText?: SliderPrimitive.Thumb.Props["getAriaValueText"];
}) {
  return (
    <SliderPrimitive.Root data-slot="slider" {...props}>
      <SliderPrimitive.Control
        className={cn(
          "relative flex h-6 w-full touch-none items-center select-none data-disabled:opacity-50",
          className,
        )}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full rounded-full bg-cal-hairline">
          <SliderPrimitive.Indicator className="absolute rounded-full bg-cal-primary transition-[inline-size] duration-[var(--duration-fast)] ease-[var(--ease-standard)]" />
          {ticks > 1 ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-between px-[3px]"
            >
              {Array.from({ length: ticks }, (_, index) =>
                ticks > 1 ? index / (ticks - 1) : 0,
              ).map((fraction) => (
                <span
                  key={fraction}
                  className="size-1 rounded-full bg-cal-muted/50"
                />
              ))}
            </div>
          ) : null}
          {/* `bg-cal-surface-card`, not `bg-cal-surface` — the latter is not a
              token in `@theme` (only `-soft`, `-card`, `-strong`, `-dark`), so
              it compiled to nothing and the thumb rendered with a visible
              border around a transparent centre. The primary-coloured ring
              keeps it legible against the filled track in both themes. */}
          <SliderPrimitive.Thumb
            getAriaValueText={getAriaValueText}
            className="size-4 rounded-full border-2 border-cal-primary bg-cal-surface-card shadow-control transition-[left] duration-[var(--duration-fast)] ease-[var(--ease-standard)] focus-visible:outline-2 focus-visible:outline-cal-primary focus-visible:outline-offset-2"
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
