"use client";

import { TEMPLATE_ICON_OPTIONS, type TemplateIconName } from "@/lib/templateIcons";
import { cn } from "@/lib/cn";

type IconPickerProps = {
  value: TemplateIconName | null;
  onChange: (next: TemplateIconName | null) => void;
  clearable?: boolean;
};

export function IconPicker({ value, onChange, clearable = true }: IconPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
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
