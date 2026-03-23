import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="card"
        className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} data-slot="card-content" className={cn("p-6", className)} {...props} />;
  }
);
CardContent.displayName = "CardContent";

export { Card, CardContent };
