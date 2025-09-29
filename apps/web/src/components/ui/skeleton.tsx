"use client";

import { cn } from "@/lib/cn";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[calc(var(--radius)-0.125rem)] bg-muted/40",
        className,
      )}
    />
  );
}

export { Skeleton };
