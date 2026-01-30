// TODO(fe): Executions page is WIP

"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/shared/Container";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Trash2 } from "lucide-react";
import { useExecutionsList } from "@/features/executions/hooks/useExecutionsList";
import { ExecutionsTable } from "@/features/executions/components/ExecutionsTable";
import { MetricsCards } from "@/features/executions/components/MetricsCards";
import type { WorkflowExecutionStatus } from "@/features/canvas/types/execution";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ExecutionsPage() {
  const {
    executions,
    metrics,
    isLoading,
    filters,
    setFilters,
    refresh,
    deleteExecution,
    clearHistory,
  } = useExecutionsList();

  const handleStatusFilterChange = (value: string) => {
    setFilters({
      ...filters,
      status: value === "all" ? "all" : (value as WorkflowExecutionStatus),
    });
  };

  return (
    <Container className="py-12" widthClassName="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <PageHeader
          title="Executions"
          description="Track workflow runs and inspect their outputs."
        />

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <Select
            value={filters.status || "all"}
            onValueChange={handleStatusFilterChange}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="halted">Halted</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>

          {/* Clear History */}
          {executions.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Clear History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all execution history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {executions.length} execution
                    records. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearHistory}>
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="mt-8">
        <MetricsCards metrics={metrics} />
      </div>

      {/* Executions Table */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Recent Executions
          </h2>
          <div className="text-sm text-muted-foreground">
            {executions.length} {executions.length === 1 ? "execution" : "executions"}
          </div>
        </div>
        <ExecutionsTable
          executions={executions}
          isLoading={isLoading}
          onDelete={deleteExecution}
        />
      </div>
    </Container>
  );
}
