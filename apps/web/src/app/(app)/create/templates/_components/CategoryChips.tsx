"use client";

import { cn } from "@/lib/cn";
import type { TemplateCategorySummary } from "@/client/types.gen";

type CategoryChipsProps = {
  categories: TemplateCategorySummary[];
  selected: string | null;
  onChange: (next: string | null) => void;
  totalCount: number;
};

/**
 * Horizontal scrollable chip row with the canonical category list + an
 * implicit "All" chip. Per-category counts come from
 * ``GET /templates/categories`` and reflect the current user's visibility
 * (public + own).
 */
export function CategoryChips({ categories, selected, onChange, totalCount }: CategoryChipsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2"
      role="tablist"
      aria-label="Template categories"
    >
      <Chip
        active={selected === null}
        count={totalCount}
        label="All"
        onClick={() => onChange(null)}
      />
      {categories.map((category) => (
        <Chip
          key={category.value}
          active={selected === category.value}
          count={category.count}
          label={category.label}
          onClick={() => onChange(category.value)}
        />
      ))}
    </div>
  );
}

function Chip({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "ml-1.5 text-[10px]",
          active ? "text-primary-foreground/80" : "text-muted-foreground/70",
        )}
      >
        {count}
      </span>
    </button>
  );
}
