"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type TagsInputProps = {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Optional cap on number of tags. Defaults to 20. */
  maxTags?: number;
};

function normaliseTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Chip-style tags input. Press Enter or comma to add a tag. Backspace on the
 * empty input removes the most recent chip. Tags are normalised to
 * ``lower-kebab-case`` to match the slugs the seeder expects.
 */
export function TagsInput({
  id,
  value,
  onChange,
  placeholder = "Add a tag and press Enter",
  maxTags = 20,
}: TagsInputProps) {
  const [draft, setDraft] = useState("");

  const commitTag = (raw: string) => {
    const tag = normaliseTag(raw);
    if (!tag) return;
    if (value.includes(tag)) return;
    if (value.length >= maxTags) return;
    onChange([...value, tag]);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitTag(draft);
      setDraft("");
    } else if (event.key === "Backspace" && !draft && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-[2.5rem] flex-wrap items-center gap-1 rounded-md border border-input bg-background p-1.5",
        "focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            aria-label={`Remove tag ${tag}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => {
          if (draft.trim()) {
            commitTag(draft);
            setDraft("");
          }
        }}
        placeholder={value.length === 0 ? placeholder : ""}
        className="h-7 flex-1 border-none px-1 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
