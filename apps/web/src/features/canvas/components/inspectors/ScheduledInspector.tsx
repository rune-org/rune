import type { Node } from "@xyflow/react";
import type { ScheduledData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/toast";

const MAX_INTERVAL_SECONDS = 31536000; // 1 year in seconds

type ScheduledInspectorProps = {
  node: Node<ScheduledData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

// Convert seconds to days, hours, minutes, seconds
function secondsToInterval(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

// Convert days, hours, minutes, seconds to total seconds
function intervalToSeconds(days: number, hours: number, minutes: number, seconds: number) {
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

export function ScheduledInspector({
  node,
  updateData,
  isExpanded,
}: ScheduledInspectorProps) {
  const updateScheduledData = (updater: (data: ScheduledData) => ScheduledData) => {
    updateData(node.id, "scheduled", updater);
  };

  // Initialize interval breakdown from stored seconds
  const initialInterval = secondsToInterval(node.data.interval_seconds ?? 60);
  const [days, setDays] = useState(initialInterval.days);
  const [hours, setHours] = useState(initialInterval.hours);
  const [minutes, setMinutes] = useState(initialInterval.minutes);
  const [seconds, setSeconds] = useState(initialInterval.seconds);

  // Update interval_seconds when any component changes
  useEffect(() => {
    const totalSeconds = intervalToSeconds(days, hours, minutes, seconds);
    if (totalSeconds > 0 && totalSeconds !== node.data.interval_seconds) {
      updateScheduledData((d) => ({
        ...d,
        interval_seconds: totalSeconds,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, hours, minutes, seconds]);

  const validateInterval = () => {
    const totalSeconds = intervalToSeconds(days, hours, minutes, seconds);
    if (totalSeconds <= 0) {
      toast.error("Interval must be greater than 0");
    } else if (totalSeconds > MAX_INTERVAL_SECONDS) {
      toast.error("Interval cannot exceed 1 year (31536000 seconds)");
    }
  };

  // Sync local state when node data changes externally
  useEffect(() => {
    const interval = secondsToInterval(node.data.interval_seconds ?? 60);
    setDays(interval.days);
    setHours(interval.hours);
    setMinutes(interval.minutes);
    setSeconds(interval.seconds);
  }, [node.data.interval_seconds]);

  const handleStartTimeQuickSelect = (offset: number) => {
    const now = new Date();
    const targetTime = new Date(now.getTime() + offset * 60000); // offset in minutes
    const utcIsoString = targetTime.toISOString();
    updateScheduledData((d) => ({
      ...d,
      start_at: utcIsoString,
    }));
  };

  const handleStartTimeChange = (value: string) => {
    if (!value) {
      updateScheduledData((d) => ({
        ...d,
        start_at: undefined,
      }));
      return;
    }
    // Convert datetime-local (YYYY-MM-DDTHH:mm) to UTC ISO string
    const localDate = new Date(value);
    if (isNaN(localDate.getTime())) {
      toast.error("Invalid date/time format");
      return;
    }
    const utcIsoString = localDate.toISOString();
    updateScheduledData((d) => ({
      ...d,
      start_at: utcIsoString,
    }));
  };

  const validateStartTime = () => {
    if (node.data.start_at && new Date(node.data.start_at) < new Date()) {
      toast.warning("Start time is in the past - will run immediately when activated");
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">
          Start At *
        </label>
        <input
          type="datetime-local"
          required
          className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
          value={
            node.data.start_at
              ? new Date(node.data.start_at).toISOString().slice(0, 16)
              : ""
          }
          onInput={(e) => handleStartTimeChange(e.currentTarget.value)}
          onBlur={validateStartTime}
        />
        <div className="mt-2 flex gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => handleStartTimeQuickSelect(0)}
            className="text-xs px-2 py-1 rounded border border-input bg-background hover:bg-muted/50"
          >
            Now
          </button>
          <button
            type="button"
            onClick={() => handleStartTimeQuickSelect(5)}
            className="text-xs px-2 py-1 rounded border border-input bg-background hover:bg-muted/50"
          >
            +5m
          </button>
          <button
            type="button"
            onClick={() => handleStartTimeQuickSelect(15)}
            className="text-xs px-2 py-1 rounded border border-input bg-background hover:bg-muted/50"
          >
            +15m
          </button>
          <button
            type="button"
            onClick={() => handleStartTimeQuickSelect(30)}
            className="text-xs px-2 py-1 rounded border border-input bg-background hover:bg-muted/50"
          >
            +30m
          </button>
        </div>
        {isExpanded && (
          <div className="mt-1 text-xs text-muted-foreground/70">
            When to start the schedule. UTC time is used.
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          Run Every *
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted-foreground/70 mb-1">
              Days
            </label>
            <input
              type="number"
              min="0"
              className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
              value={days}
              onChange={(e) => setDays(Math.max(0, Number(e.target.value)))}
              onBlur={validateInterval}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground/70 mb-1">
              Hours
            </label>
            <input
              type="number"
              min="0"
              max="23"
              className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
              value={hours}
              onChange={(e) => setHours(Math.max(0, Math.min(23, Number(e.target.value))))}
              onBlur={validateInterval}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground/70 mb-1">
              Minutes
            </label>
            <input
              type="number"
              min="0"
              max="59"
              className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
              onBlur={validateInterval}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground/70 mb-1">
              Seconds
            </label>
            <input
              type="number"
              min="0"
              max="59"
              className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
              value={seconds}
              onChange={(e) => setSeconds(Math.max(0, Math.min(59, Number(e.target.value))))}
              onBlur={validateInterval}
            />
          </div>
        </div>
        {isExpanded && (
          <div className="mt-1 text-xs text-muted-foreground/70">
            Total: {intervalToSeconds(days, hours, minutes, seconds)} seconds
          </div>
        )}
      </div>
    </div>
  );
}
