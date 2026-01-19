import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        // Gold button - primary action
        default:
          "bg-[#C9A75E] text-[#0F0F12] font-semibold hover:bg-[#B8924B] active:bg-[#A6833F]",
        // Outlined button - secondary action
        outline:
          "border border-[#3A3A40] bg-transparent text-white hover:bg-[#2A2A30] hover:border-[#4A4A50] active:bg-[#3A3A40]",
        // Ghost button - tertiary action
        ghost:
          "bg-transparent text-[#AFAFB3] hover:bg-[#2A2A30] hover:text-white active:bg-[#3A3A40]",
        // Secondary solid button
        secondary:
          "bg-[#2A2A30] text-white hover:bg-[#3A3A40] active:bg-[#4A4A50]",
        // Destructive button
        destructive:
          "bg-[#D9534F] text-white hover:bg-[#C9433F] active:bg-[#B9332F]",
        // Link style
        link: "text-[#C9A75E] underline-offset-4 hover:underline hover:text-[#B8924B]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "size-10",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
