import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type FC,
} from "react"

import { cn } from "@/lib/utils"

export interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<"span"> {
  shimmerWidth?: number
}

export const AnimatedShinyText: FC<AnimatedShinyTextProps> = ({
  children,
  className,
  shimmerWidth = 100,
  ...props
}) => {
  return (
    <span
      style={
        {
          "--shiny-width": `${shimmerWidth}px`,
        } as CSSProperties
      }
      className={cn(
        "mx-auto max-w-md text-neutral-600/70 dark:text-neutral-400/70",

        // Shine effect
        "animate-shiny-text bg-size-[var(--shiny-width)_100%] bg-clip-text bg-position-[0_0] bg-no-repeat [animation-duration:2.5s] [animation-timing-function:linear]",

        // Use an asymmetric streak so the sweep reads as directional rather than oscillating.
        "bg-linear-to-r from-transparent from-35% via-black/80 via-55% to-black/10 to-72% dark:via-white/90 dark:to-white/15",

        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
