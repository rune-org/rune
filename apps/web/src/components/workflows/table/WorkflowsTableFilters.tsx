import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { StatFilter } from "@/components/workflows/table/workflowTableTypes";

type WorkflowsTableFiltersProps = {
  stats: { active: number; runs: number; draft: number; failed: number };
  filter: StatFilter;
  onFilterChange: (next: StatFilter) => void;
  query: string;
  onQueryChange: (value: string) => void;
};

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={active ? "text-accent" : "text-muted-foreground hover:text-foreground"}
    >
      <span className="font-semibold">{count}</span> {label}
    </button>
  );
}

export function WorkflowsTableFilters({
  stats,
  filter,
  onFilterChange,
  query,
  onQueryChange,
}: WorkflowsTableFiltersProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm">
          <FilterButton
            label="Active"
            count={stats.active}
            active={filter === "active"}
            onClick={() => onFilterChange(filter === "active" ? "all" : "active")}
          />
          <FilterButton
            label="Runs"
            count={stats.runs}
            active={filter === "runs"}
            onClick={() => onFilterChange(filter === "runs" ? "all" : "runs")}
          />
          <FilterButton
            label="Draft"
            count={stats.draft}
            active={filter === "draft"}
            onClick={() => onFilterChange(filter === "draft" ? "all" : "draft")}
          />
          <FilterButton
            label="Failed"
            count={stats.failed}
            active={filter === "failed"}
            onClick={() => onFilterChange(filter === "failed" ? "all" : "failed")}
          />
        </div>
      </div>

      <div className="relative">
        <Input
          placeholder="Search workflows…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="pl-10"
          aria-label="Search workflows"
        />
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </>
  );
}
