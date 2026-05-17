import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:bg-cal-primary-disabled disabled:text-cal-muted disabled:opacity-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-cal-primary text-primary-foreground hover:bg-cal-primary-active [a]:hover:bg-cal-primary-active",
        outline:
          "border-cal-hairline bg-cal-canvas text-cal-ink hover:bg-cal-surface-soft aria-expanded:bg-cal-surface-soft",
        secondary:
          "border-cal-hairline bg-cal-canvas text-cal-ink hover:bg-cal-surface-soft aria-expanded:bg-cal-surface-soft",
        ghost:
          "text-cal-ink hover:bg-cal-surface-soft aria-expanded:bg-cal-surface-soft disabled:bg-transparent",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "rounded-none px-0 text-cal-ink underline-offset-4 hover:underline disabled:bg-transparent",
      },
      size: {
        default: "min-h-11 gap-2 px-5",
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-10 gap-1.5 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "min-h-11 gap-2 px-5",
        icon: "size-9 rounded-full",
        "icon-xs": "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-full",
        "icon-lg": "size-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
