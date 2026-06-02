import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserBasicInfo } from "@/client/types.gen";
import type { StatFilter } from "@/components/workflows/table/workflowTableTypes";

type WorkflowsTableFiltersProps = {
  stats: { active: number; inactive: number; runs: number; draft: number; failed: number };
  filter: StatFilter;
  onFilterChange: (next: StatFilter) => void;
  query: string;
  onQueryChange: (value: string) => void;
  isAdmin: boolean;
  users: UserBasicInfo[];
  ownerId: number | null;
  onOwnerChange: (ownerId: number | null) => void;
  accessScope: "all" | "mine" | "shared";
  onAccessScopeChange: (scope: "all" | "mine" | "shared") => void;
  currentUserId: number | null;
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
  isAdmin,
  users,
  ownerId,
  onOwnerChange,
  accessScope,
  onAccessScopeChange,
  currentUserId,
}: WorkflowsTableFiltersProps) {
  const otherUsers = users.filter((u) => u.id !== currentUserId);

  let selectValue = "all";
  if (ownerId !== null) {
    if (ownerId === currentUserId) {
      selectValue = "mine";
    } else {
      selectValue = String(ownerId);
    }
  }

  const handleValueChange = (value: string) => {
    if (value === "all") {
      onOwnerChange(null);
    } else if (value === "mine") {
      onOwnerChange(currentUserId);
    } else {
      onOwnerChange(Number(value));
    }
  };

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
            label="Inactive"
            count={stats.inactive}
            active={filter === "inactive"}
            onClick={() => onFilterChange(filter === "inactive" ? "all" : "inactive")}
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

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Input
            placeholder="Search workflows…"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="pl-10"
            aria-label="Search workflows"
          />
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        {isAdmin && users.length > 1 && (
          <Select value={selectValue} onValueChange={handleValueChange}>
            <SelectTrigger className="w-48" aria-label="Filter by owner">
              <SelectValue placeholder="All owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {currentUserId !== null && <SelectItem value="mine">Mine</SelectItem>}
              {otherUsers.map((user) => (
                <SelectItem key={user.id} value={String(user.id)}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!isAdmin && (
          <Select value={accessScope} onValueChange={onAccessScopeChange}>
            <SelectTrigger className="w-48" aria-label="Filter by access">
              <SelectValue placeholder="All workflows" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="mine">Mine</SelectItem>
              <SelectItem value="shared">Shared</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </>
  );
}
