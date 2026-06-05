"use client";

import { memo } from "react";
import { SquareDashedMousePointer } from "lucide-react";
import { cn } from "@/lib/cn";

type SelectionModeButtonProps = {
  active: boolean;
  onToggle: () => void;
};

export const SelectionModeButton = memo(function SelectionModeButton({
  active,
  onToggle,
}: SelectionModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? "Exit selection mode (Esc)" : "Selection mode"}
      aria-label={active ? "Exit selection mode" : "Enter selection mode"}
      aria-pressed={active}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-primary hover:bg-primary/25"
          : "border-border/60 bg-background/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      <SquareDashedMousePointer className="h-5 w-5" />
    </button>
  );
});
