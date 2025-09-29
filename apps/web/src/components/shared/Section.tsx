import * as React from "react";

import { cn } from "@/lib/cn";

export function Section({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("flex flex-col gap-10", className)} {...props} />
  );
}
