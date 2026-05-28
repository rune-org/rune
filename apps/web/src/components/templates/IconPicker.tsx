"use client";

import { TEMPLATE_ICON_OPTIONS, type TemplateIconName } from "@/lib/templateIcons";
import { cn } from "@/lib/cn";

type IconPickerProps = {
  value: TemplateIconName | null;
  onChange: (next: TemplateIconName | null) => void;
  clearable?: boolean;
  layout?: "grid" | "scroll-row";
};

export function IconPicker({
  value,
  onChange,
  clearable = true,
  layout = "grid",
}: IconPickerProps) {
  return (
    <div
      className={cn(
        layout === "scroll-row"
          ? "scrollbar-subtle flex gap-1.5 overflow-x-auto pb-2"
          : "grid grid-cols-8 gap-1.5",
      )}
    >
      {TEMPLATE_ICON_OPTIONS.map(({ name, label, Icon }) => {
        const active = value === name;
        return (
          <button
            key={name}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            onClick={() => onChange(active && clearable ? null : name)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md border transition-colors",
              layout === "scroll-row" && "h-9 w-9 shrink-0",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
