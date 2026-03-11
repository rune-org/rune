import { useEffect, useState } from "react";
import type { Node } from "@xyflow/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateTimeData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { VariableInput } from "../variable-picker/VariableInput";

type DateTimeInspectorProps = {
  node: Node<DateTimeData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

const OPERATIONS: Array<{ value: NonNullable<DateTimeData["operation"]>; label: string }> = [
  { value: "now", label: "Current time" },
  { value: "add", label: "Add time" },
  { value: "subtract", label: "Subtract time" },
  { value: "format", label: "Format date" },
];

const UNITS: NonNullable<DateTimeData["unit"]>[] = [
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
  "years",
];

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Tokyo",
] as const;

const FORMAT_OPTIONS = [
  { value: "2006-01-02T15:04:05Z07:00", label: "ISO timestamp" },
  { value: "2006-01-02", label: "Date only" },
  { value: "2006-01-02 15:04", label: "Date and time" },
  { value: "02 Jan 2006", label: "Readable date" },
  { value: "Mon, 02 Jan 2006 15:04 MST", label: "Full readable" },
] as const;

export function DateTimeInspector({ node, updateData, isExpanded }: DateTimeInspectorProps) {
  const operation = node.data.operation ?? "now";
  const needsDate = operation !== "now";
  const needsAmount = operation === "add" || operation === "subtract";
  const timezoneValue = node.data.timezone ?? "UTC";
  const formatValue = node.data.format ?? "2006-01-02T15:04:05Z07:00";
  const [isCustomTimezone, setIsCustomTimezone] = useState(
    !TIMEZONE_OPTIONS.includes(timezoneValue as (typeof TIMEZONE_OPTIONS)[number]),
  );
  const [isCustomFormat, setIsCustomFormat] = useState(
    !FORMAT_OPTIONS.some((option) => option.value === formatValue),
  );

  useEffect(() => {
    if (TIMEZONE_OPTIONS.includes(timezoneValue as (typeof TIMEZONE_OPTIONS)[number])) {
      setIsCustomTimezone(false);
    }
  }, [timezoneValue]);

  useEffect(() => {
    if (FORMAT_OPTIONS.some((option) => option.value === formatValue)) {
      setIsCustomFormat(false);
    }
  }, [formatValue]);

  const updateDateTimeData = (updater: (data: DateTimeData) => DateTimeData) => {
    updateData(node.id, "datetime", updater);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">Action</label>
        <Select
          value={operation}
          onValueChange={(value) => updateDateTimeData((d) => ({ ...d, operation: value as DateTimeData["operation"] }))}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATIONS.map((operationOption) => (
              <SelectItem key={operationOption.value} value={operationOption.value}>
                {operationOption.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsDate && (
        <div>
          <label className="block text-xs text-muted-foreground">
            {operation === "format" ? "Date or timestamp" : "Starting date (optional)"}
          </label>
          <VariableInput
            value={node.data.date ?? ""}
            onChange={(value) => updateDateTimeData((d) => ({ ...d, date: value }))}
            placeholder="2026-03-08T15:30:00Z"
            nodeId={node.id}
          />
          <div className="mt-1 text-[10px] text-muted-foreground/70">
            {operation === "format"
              ? "This is the date you want to format."
              : "Leave this empty to start from the current time."}
          </div>
        </div>
      )}

      {needsAmount && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted-foreground">Amount</label>
            <input
              type="number"
              className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
              value={node.data.amount ?? 1}
              onChange={(e) => updateDateTimeData((d) => ({ ...d, amount: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground">Unit</label>
            <Select
              value={node.data.unit ?? "days"}
              onValueChange={(value) => updateDateTimeData((d) => ({ ...d, unit: value as DateTimeData["unit"] }))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs text-muted-foreground">Timezone</label>
        <Select
          value={isCustomTimezone ? "__custom__" : timezoneValue}
          onValueChange={(value) => {
            if (value === "__custom__") {
              setIsCustomTimezone(true);
              return;
            }
            setIsCustomTimezone(false);
            updateDateTimeData((d) => ({ ...d, timezone: value }));
          }}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONE_OPTIONS.map((timezone) => (
              <SelectItem key={timezone} value={timezone}>
                {timezone}
              </SelectItem>
            ))}
            <SelectItem value="__custom__">Custom timezone</SelectItem>
          </SelectContent>
        </Select>
        {isCustomTimezone && (
          <input
            className="mt-2 w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
            value={timezoneValue}
            onChange={(e) => updateDateTimeData((d) => ({ ...d, timezone: e.target.value }))}
            placeholder="America/Chicago"
          />
        )}
      </div>

      <div>
        <label className="block text-xs text-muted-foreground">Output format</label>
        <Select
          value={isCustomFormat ? "__custom__" : formatValue}
          onValueChange={(value) => {
            if (value === "__custom__") {
              setIsCustomFormat(true);
              return;
            }
            setIsCustomFormat(false);
            updateDateTimeData((d) => ({ ...d, format: value }));
          }}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMAT_OPTIONS.map((format) => (
              <SelectItem key={format.value} value={format.value}>
                {format.label}
              </SelectItem>
            ))}
            <SelectItem value="__custom__">Custom format</SelectItem>
          </SelectContent>
        </Select>
        {isCustomFormat && (
          <input
            className="mt-2 w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
            value={formatValue}
            onChange={(e) => updateDateTimeData((d) => ({ ...d, format: e.target.value }))}
            placeholder="2006-01-02"
          />
        )}
        <div className="mt-1 text-[10px] text-muted-foreground/70">
          Pick a preset or choose custom to type your own Go time layout.
        </div>
      </div>

      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          Use this node for things like the current date, a deadline 3 days from now, or formatting a timestamp before sending it in a message.
        </div>
      )}
    </div>
  );
}
