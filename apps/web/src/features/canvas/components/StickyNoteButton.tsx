"use client";

import { memo } from "react";

function StickyNoteIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M5.62503 19H14.625V15C14.625 14.7167 14.7209 14.4792 14.9125 14.2875C15.1042 14.0958 15.3417 14 15.625 14H19.625V5H5.62503V19ZM5.62503 21C5.07503 21 4.6042 20.8042 4.21253 20.4125C3.82086 20.0208 3.62503 19.55 3.62503 19V5C3.62503 4.45 3.82086 3.97917 4.21253 3.5875C4.6042 3.19583 5.07503 3 5.62503 3H19.625C20.175 3 20.6459 3.19583 21.0375 3.5875C21.4292 3.97917 21.625 4.45 21.625 5V14.175C21.625 14.4417 21.575 14.6958 21.475 14.9375C21.375 15.1792 21.2334 15.3917 21.05 15.575L16.2 20.425C16.0167 20.6083 15.8042 20.75 15.5625 20.85C15.3209 20.95 15.0667 21 14.8 21H5.62503Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
      <StickyNoteIcon className="h-5 w-5" />
    </button>
  );
});
