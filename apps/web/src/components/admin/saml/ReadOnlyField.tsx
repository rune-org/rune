"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

import { CopyButton } from "./CopyButton";

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  multiline?: boolean;
}

export function ReadOnlyField({
  label,
  value,
  hint,
  mono = true,
  multiline = false,
}: ReadOnlyFieldProps) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </Label>
        <CopyButton value={value} />
      </div>

      {multiline ? (
        <div
          className={cn(
            "max-h-32 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-[11px] leading-relaxed text-foreground/80",
            mono && "font-mono break-all",
          )}
        >
          {value}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
          <span
            className={cn(
              "flex-1 truncate text-sm text-foreground/90",
              mono && "font-mono text-[11px]",
            )}
          >
            {value}
          </span>
        </div>
      )}

      {hint && <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
