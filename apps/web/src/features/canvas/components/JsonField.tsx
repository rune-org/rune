"use client";

import { useEffect, useState } from "react";

type JsonFieldProps = {
  value?: unknown;
  onChange: (value: unknown) => void;
  objectOnly?: boolean;
  emptyAsUndefined?: boolean;
};

const formatJsonValue = (value: unknown, emptyAsUndefined: boolean) => {
  if (value === undefined) {
    return emptyAsUndefined ? "" : "{}";
  }
  return JSON.stringify(value, null, 2) ?? (emptyAsUndefined ? "" : "{}");
};

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const areJsonValuesEqual = (left: unknown, right: unknown) => {
  if (left === right) return true;
  if (left === undefined || right === undefined) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

export function JsonField({
  value,
  onChange,
  objectOnly = true,
  emptyAsUndefined = false,
}: JsonFieldProps) {
  const [text, setText] = useState<string>(() => formatJsonValue(value, emptyAsUndefined));
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const next = formatJsonValue(value, emptyAsUndefined);
    setText(next);
    setIsDirty(false);
  }, [value, emptyAsUndefined]);

  const handleBlur = () => {
    try {
      if (!isDirty) return;
      const obj = text.trim() ? JSON.parse(text) : {};
      if (objectOnly && (typeof obj !== "object" || Array.isArray(obj) || obj === null)) {
        setError("Must be a JSON object");
        return;
      }
      const nextValue =
        emptyAsUndefined && isJsonObject(obj) && Object.keys(obj).length === 0 ? undefined : obj;
      setError(null);
      if (!areJsonValuesEqual(nextValue, value)) {
        onChange(nextValue);
      }
      setIsDirty(false);
    } catch {
      setError("Invalid JSON");
    }
  };

  return (
    <div className="space-y-1">
      <textarea
        className="h-24 w-full rounded-sm border border-input bg-muted/30 p-2 text-xs font-mono"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setIsDirty(true);
        }}
        onBlur={handleBlur}
        spellCheck={false}
      />
      {error ? (
        <div className="text-[11px] text-destructive">{error}</div>
      ) : (
        <div className="text-[11px] text-muted-foreground">
          {objectOnly ? "JSON object" : "JSON value"}
        </div>
      )}
    </div>
  );
}
