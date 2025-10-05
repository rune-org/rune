import * as React from "react";

import { cn } from "@/lib/cn";

type SectionSize = "sm" | "md" | "lg";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  size?: SectionSize;
}

const sizeGap: Record<SectionSize, string> = {
  sm: "gap-6",
  md: "gap-8",
  lg: "gap-10",
};

export function Section({ className, size = "lg", ...props }: SectionProps) {
  return (
    <section
      className={cn("flex flex-col", sizeGap[size], className)}
      {...props}
    />
  );
}
