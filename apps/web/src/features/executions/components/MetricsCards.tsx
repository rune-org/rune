"use client";

import { CheckCircle, Clock, XCircle, Activity, TrendingUp, Calendar } from "lucide-react";
import type { ExecutionMetrics } from "../types";
import { cn } from "@/lib/cn";

interface MetricsCardsProps {
  metrics: ExecutionMetrics;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  className?: string;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="text-muted-foreground/60">{icon}</div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        {subtitle && (
          <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
        )}
        {trend && (
          <div
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium",
              trend.isPositive ? "text-green-600" : "text-red-600"
            )}
          >
            <TrendingUp
              className={cn("h-3 w-3", !trend.isPositive && "rotate-180")}
            />
            {trend.value}%
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessRateRing({ rate }: { rate: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (rate / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        {/* Background ring */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-muted/30"
        />
        {/* Progress ring */}
        <circle
          cx="40"
          cy="40"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className={cn(
            "transition-all duration-700",
            rate >= 80
              ? "text-green-500"
              : rate >= 50
                ? "text-yellow-500"
                : "text-red-500"
          )}
        />
      </svg>
      <div className="absolute text-lg font-semibold text-foreground">
        {Math.round(rate)}%
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms === 0) return "0s";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        title="Total Executions"
        value={metrics.totalExecutions}
        subtitle={`${metrics.executionsToday} today`}
        icon={<Activity className="h-4 w-4" />}
      />

      <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30">
        <div className="flex items-start justify-between">
          <div className="text-sm font-medium text-muted-foreground">
            Success Rate
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center">
          <SuccessRateRing rate={metrics.successRate} />
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            {metrics.successfulExecutions}
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3 text-red-500" />
            {metrics.failedExecutions}
          </span>
        </div>
      </div>

      <MetricCard
        title="Avg. Duration"
        value={formatDuration(metrics.averageDurationMs)}
        icon={<Clock className="h-4 w-4" />}
      />

      <MetricCard
        title="This Week"
        value={metrics.executionsThisWeek}
        subtitle="executions"
        icon={<Calendar className="h-4 w-4" />}
      />
    </div>
  );
}

export default MetricsCards;
