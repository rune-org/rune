"use client";

import { useEffect, useState } from "react";

type JsonFieldProps = {
  value?: unknown;
  onChange: (obj: Record<string, unknown>) => void;
};

export function JsonField({ value, onChange }: JsonFieldProps) {
  const [text, setText] = useState<string>(() =>
    value ? JSON.stringify(value, null, 2) : "{}",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = value ? JSON.stringify(value, null, 2) : "{}";
    setText(next);
  }, [value]);

  const handleBlur = () => {
    try {
      const obj = text.trim() ? JSON.parse(text) : {};
      if (typeof obj !== "object" || Array.isArray(obj) || obj === null) {
        setError("Must be a JSON object");
        return;
      }
      setError(null);
      onChange(obj as Record<string, unknown>);
    } catch {
      setError("Invalid JSON");
    }
  };

  return (
    <div className="space-y-1">
      <textarea
        className="h-24 w-full rounded-sm border border-input bg-muted/30 p-2 text-xs font-mono"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        spellCheck={false}
      />
      {error ? (
        <div className="text-[11px] text-destructive">{error}</div>
      ) : (
        <div className="text-[11px] text-muted-foreground">JSON object</div>
      )}
    </div>
  );
}
