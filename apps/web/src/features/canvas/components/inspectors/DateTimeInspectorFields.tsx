import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DateTimeUnit } from "../../types";

export const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Tokyo",
] as const;

export const FORMAT_OPTIONS = [
  { value: "2006-01-02T15:04:05Z07:00", label: "ISO timestamp" },
  { value: "2006-01-02", label: "Date only" },
  { value: "2006-01-02 15:04", label: "Date and time" },
  { value: "02 Jan 2006", label: "Readable date" },
  { value: "Mon, 02 Jan 2006 15:04 MST", label: "Full readable" },
] as const;

export const UNIT_OPTIONS: DateTimeUnit[] = [
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
  "years",
];

type TimezoneFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function TimezoneField({ value, onChange }: TimezoneFieldProps) {
  const [isCustom, setIsCustom] = useState(
    !TIMEZONE_OPTIONS.includes(value as (typeof TIMEZONE_OPTIONS)[number]),
  );

  useEffect(() => {
    if (TIMEZONE_OPTIONS.includes(value as (typeof TIMEZONE_OPTIONS)[number])) {
      setIsCustom(false);
    }
  }, [value]);

  return (
    <div>
      <label className="block text-xs text-muted-foreground">Timezone</label>
      <Select
        value={isCustom ? "__custom__" : value}
        onValueChange={(next) => {
          if (next === "__custom__") {
            setIsCustom(true);
            return;
          }
          setIsCustom(false);
          onChange(next);
        }}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIMEZONE_OPTIONS.map((tz) => (
            <SelectItem key={tz} value={tz}>
              {tz}
            </SelectItem>
          ))}
          <SelectItem value="__custom__">Custom timezone</SelectItem>
        </SelectContent>
      </Select>
      {isCustom && (
        <div className="relative mt-2">
          <input
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 pr-8 text-sm"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="America/Chicago"
          />
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Custom timezone help"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-left">
                Enter an IANA timezone name like
                <span className="font-mono"> America/Chicago</span>,
                <span className="font-mono"> Europe/Berlin</span>, or
                <span className="font-mono"> Asia/Kolkata</span>.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

type FormatFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function FormatField({ value, onChange }: FormatFieldProps) {
  const [isCustom, setIsCustom] = useState(
    !FORMAT_OPTIONS.some((option) => option.value === value),
  );

  useEffect(() => {
    if (FORMAT_OPTIONS.some((option) => option.value === value)) {
      setIsCustom(false);
    }
  }, [value]);

  return (
    <div>
      <label className="block text-xs text-muted-foreground">Output format</label>
      <Select
        value={isCustom ? "__custom__" : value}
        onValueChange={(next) => {
          if (next === "__custom__") {
            setIsCustom(true);
            return;
          }
          setIsCustom(false);
          onChange(next);
        }}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FORMAT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
          <SelectItem value="__custom__">Custom format</SelectItem>
        </SelectContent>
      </Select>
      {isCustom && (
        <input
          className="mt-2 w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="2006-01-02"
        />
      )}
      <div className="mt-1 text-[10px] text-muted-foreground/70">
        Pick a preset or choose custom to type your own Go time layout.
      </div>
    </div>
  );
}
