import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[10px] border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none select-none focus-visible:border-km-accent focus-visible:ring-3 focus-visible:ring-km-accent/20 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:bg-km-primary-disabled disabled:text-km-muted disabled:opacity-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-km-primary text-primary-foreground shadow-[0_1px_2px_rgb(20_22_23/0.12)] hover:bg-km-primary-active [a]:hover:bg-km-primary-active",
        outline:
          "border-km-hairline bg-km-surface text-km-ink hover:border-km-accent/40 hover:bg-km-surface-muted aria-expanded:bg-km-surface-muted",
        secondary:
          "border-km-hairline bg-km-surface text-km-ink hover:border-km-accent/40 hover:bg-km-surface-muted aria-expanded:bg-km-surface-muted",
        ghost:
          "text-km-ink hover:bg-km-surface-muted aria-expanded:bg-km-surface-muted disabled:bg-transparent",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "rounded-none px-0 text-km-accent underline-offset-4 hover:underline disabled:bg-transparent",
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
