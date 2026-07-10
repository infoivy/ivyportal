import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/[0.04] text-muted-foreground",
        secondary: "border-white/10 bg-white/[0.04] text-muted-foreground",
        destructive: "border-red-500/30 bg-red-500/10 text-red-400",
        outline: "border-white/10 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
