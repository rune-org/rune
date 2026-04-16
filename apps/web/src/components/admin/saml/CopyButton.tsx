"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/cn";

interface CopyButtonProps {
  value: string;
}

export function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetCopiedTimeoutRef.current) {
        clearTimeout(resetCopiedTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }

    setCopied(true);
    if (resetCopiedTimeoutRef.current) {
      clearTimeout(resetCopiedTimeoutRef.current);
    }
    resetCopiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy to clipboard"}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs transition-all",
        copied
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
          : "border-border/60 bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
