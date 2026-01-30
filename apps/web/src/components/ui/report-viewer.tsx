"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileText, Copy, Check } from "lucide-react";
import Image from "next/image";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { toast } from "@/components/ui/toast";

interface ReportViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  title?: string;
}

export function ReportViewer({
  open,
  onOpenChange,
  content,
  title = "Workflow Documentation",
}: ReportViewerProps) {
  const [copied, setCopied] = React.useState(false);

  const handleDownload = React.useCallback(() => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workflow-docs.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Documentation downloaded");
  }, [content]);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, [content]);

  const fileSize = React.useMemo(
    () => `${(new Blob([content]).size / 1024).toFixed(1)} KB`,
    [content]
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="fixed inset-4 z-50 mx-auto flex max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl md:inset-8 lg:inset-12"
              >
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-zinc-900/50 px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                      <Image
                        src="/icons/scryb_logo_compact_white.svg"
                        alt="Scryb"
                        width={24}
                        height={24}
                        className="h-6 w-6 opacity-90"
                      />
                    </div>
                    <div className="flex flex-col">
                      <DialogPrimitive.Title className="text-lg font-semibold text-zinc-100">
                        {title}
                      </DialogPrimitive.Title>
                      <DialogPrimitive.Description className="flex items-center gap-2 text-sm text-zinc-500">
                        <FileText className="h-3.5 w-3.5" />
                        <span>workflow-docs.md</span>
                        <span className="text-zinc-600">•</span>
                        <span>{fileSize}</span>
                      </DialogPrimitive.Description>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
                      aria-label="Copy to clipboard"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">
                        {copied ? "Copied" : "Copy"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
                      aria-label="Download documentation"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                    <DialogPrimitive.Close asChild>
                      <button
                        type="button"
                        className="ml-2 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200"
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </DialogPrimitive.Close>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                  <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8 lg:py-10">
                    <MarkdownRenderer content={content} />
                  </div>
                </div>

                {/* Footer gradient */}
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent" />
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
