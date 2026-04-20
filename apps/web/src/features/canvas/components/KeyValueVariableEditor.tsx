"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { VariableInput } from "./variable-picker/VariableInput";

type Entry = {
  id: string;
  key: string;
  value: string;
};

type KeyValueVariableEditorProps = {
  value?: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  nodeId: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  emptyLabel?: string;
};

function entriesFromRecord(record: Record<string, unknown> | undefined, seed: number): Entry[] {
  if (!record) return [];
  return Object.entries(record).map(([key, value], i) => ({
    id: `entry-${seed}-${i}`,
    key,
    value: typeof value === "string" ? value : value == null ? "" : JSON.stringify(value),
  }));
}

function recordFromEntries(entries: Entry[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { key, value } of entries) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    out[trimmed] = value;
  }
  return out;
}

function recordsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function KeyValueVariableEditor({
  value,
  onChange,
  nodeId,
  keyPlaceholder = "Name",
  valuePlaceholder = "Value",
  addLabel = "Add",
  emptyLabel = "No entries defined.",
}: KeyValueVariableEditorProps) {
  const idCounter = useRef(0);
  const nextId = useCallback(() => {
    idCounter.current += 1;
    return `entry-new-${idCounter.current}`;
  }, []);

  const [entries, setEntries] = useState<Entry[]>(() => entriesFromRecord(value, 0));

  const lastEmittedRef = useRef<Record<string, unknown>>(value ?? {});

  useEffect(() => {
    const incoming = value ?? {};
    if (recordsEqual(lastEmittedRef.current, incoming)) return;
    lastEmittedRef.current = incoming;
    idCounter.current += 1;
    setEntries(entriesFromRecord(incoming, idCounter.current));
  }, [value]);

  const emitChange = useCallback(
    (next: Entry[]) => {
      const nextRecord = recordFromEntries(next);
      if (recordsEqual(lastEmittedRef.current, nextRecord)) return;
      lastEmittedRef.current = nextRecord;
      onChange(nextRecord);
    },
    [onChange],
  );

  const updateEntries = useCallback(
    (updater: (prev: Entry[]) => Entry[]) => {
      setEntries((prev) => {
        const next = updater(prev);
        emitChange(next);
        return next;
      });
    },
    [emitChange],
  );

  const addEntry = () => {
    updateEntries((prev) => [...prev, { id: nextId(), key: "", value: "" }]);
  };

  const removeEntry = (id: string) => {
    updateEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const updateKey = (id: string, key: string) => {
    updateEntries((prev) => prev.map((e) => (e.id === id ? { ...e, key } : e)));
  };

  const updateValue = (id: string, value: string) => {
    updateEntries((prev) => prev.map((e) => (e.id === id ? { ...e, value } : e)));
  };

  return (
    <div className="mt-2 space-y-2">
      {entries.length > 0 ? (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-1.5">
              <input
                className="w-1/3 shrink-0 rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-xs"
                value={entry.key}
                onChange={(e) => updateKey(entry.id, e.target.value)}
                placeholder={keyPlaceholder}
                spellCheck={false}
              />
              <div className="min-w-0 flex-1">
                <VariableInput
                  value={entry.value}
                  onChange={(v) => updateValue(entry.id, v)}
                  nodeId={nodeId}
                  placeholder={valuePlaceholder}
                />
              </div>
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                aria-label="Remove entry"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[calc(var(--radius)-0.3rem)] border border-dashed border-border/60 bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground">
          {emptyLabel}
        </div>
      )}
      <button
        type="button"
        onClick={addEntry}
        className="inline-flex items-center gap-1 rounded-[calc(var(--radius)-0.3rem)] border border-border/60 bg-muted/40 px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/70"
      >
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  );
}
