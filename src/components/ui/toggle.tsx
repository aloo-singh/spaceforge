"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-75 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-transparent hover:bg-muted hover:text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground data-[state=on]:border-selected-surface-border data-[state=on]:bg-selected-surface data-[state=on]:text-selected-surface-foreground",
        toolbar:
          "border border-border bg-background text-muted-foreground shadow-xs hover:bg-muted hover:text-foreground aria-pressed:border-blue-500 aria-pressed:bg-blue-500 aria-pressed:text-white aria-pressed:shadow-sm aria-pressed:hover:bg-blue-500/90 data-[active=true]:border-blue-500 data-[active=true]:bg-blue-500 data-[active=true]:text-white data-[active=true]:shadow-sm data-[active=true]:hover:bg-blue-500/90 dark:border-input dark:bg-input/30 dark:text-muted-foreground dark:hover:bg-input/50 dark:hover:text-foreground dark:aria-pressed:border-blue-500 dark:aria-pressed:bg-blue-500 dark:aria-pressed:text-white dark:aria-pressed:hover:bg-blue-500/90 dark:data-[active=true]:border-blue-500 dark:data-[active=true]:bg-blue-500 dark:data-[active=true]:text-white dark:data-[active=true]:hover:bg-blue-500/90",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        lg: "h-11 px-5",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    data-slot="toggle"
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
))

Toggle.displayName = TogglePrimitive.Root.displayName

export { Toggle, toggleVariants }
