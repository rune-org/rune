"use client";

import { memo } from "react";
import { NotepadText } from "lucide-react";

type StickyNoteButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export const StickyNoteButton = memo(function StickyNoteButton({
  onClick,
  disabled,
}: StickyNoteButtonProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title="Add note"
      aria-label="Add note"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-300/70 bg-amber-100 text-amber-700 shadow-lg transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-300/30 dark:bg-amber-200/15 dark:text-amber-200 dark:hover:bg-amber-200/25"
    >
      <NotepadText className="h-5 w-5" />
    </button>
  );
});
