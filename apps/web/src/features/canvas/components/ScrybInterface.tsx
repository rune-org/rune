"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Playfair_Display } from "next/font/google";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ArrowRight, Loader2, X, Check, Download, SquarePen, ExternalLink, ChevronLeft, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-playfair",
});

type ViewState = "idle" | "generating" | "success";

const RUNE_HINTS = [
  "Tip: Connect an 'Error' output to an Email node for instant failure alerts.",
  "Did you know? The Switch node can replace multiple If/Else blocks for cleaner logic.",
  "Pro Tip: Meaningful node labels help generate more precise documentation.",
  "Tip: Use the Auto-Layout feature for a more organized workspace.",
  "Hint: Group related nodes to keep your workflow visual structure organized.",
  "Best Practice: Use the 'Http' node to integrate with external APIs seamlessly.",
];

const getRandomHint = () => RUNE_HINTS[Math.floor(Math.random() * RUNE_HINTS.length)];

type ScrybInterfaceProps = {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ScrybInterface({ 
  isOpen: isOpenProp, 
  onOpenChange 
}: ScrybInterfaceProps) {
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [hint, setHint] = useState("");

  const isOpen = isOpenProp ?? isOpenInternal;
  const setIsOpen = onOpenChange ?? setIsOpenInternal;

  useEffect(() => {
    setHint(getRandomHint());
  }, []);

  const handleGenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewState("generating");
    
    // Simulate generation
    // TODO(ash): don't forget this file
    setTimeout(() => {
      setViewState("success");
    }, 2500);
  };

  const resetView = () => {
    setViewState("idle");
    setHint(getRandomHint());
  };

  return (
    <div className="relative flex flex-col items-end justify-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-labelledby="scryb-panel-title"
            aria-modal="false"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              "w-[360px] origin-bottom-right overflow-hidden rounded-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl",
              playfair.variable
            )}
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            {/* Background Layers */}
            <div className="absolute inset-0 bg-zinc-950/80 z-0" />
            <div 
              className="absolute inset-0 z-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
              style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'repeat',
              }} 
            />
            <motion.div 
              animate={{ 
                x: [0, -40, 0], 
                y: [0, 40, 0],
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{ 
                duration: 8, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="absolute -top-[100px] -right-[100px] w-[300px] h-[300px] rounded-full bg-purple-500/30 blur-[80px] pointer-events-none z-0" 
            />
            <motion.div 
              animate={{ 
                x: [0, 50, 0], 
                y: [0, -40, 0],
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{ 
                duration: 10, 
                repeat: Infinity, 
                ease: "easeInOut",
                delay: 1
              }}
              className="absolute -bottom-[100px] -left-[100px] w-[300px] h-[300px] rounded-full bg-emerald-500/30 blur-[80px] pointer-events-none z-0" 
            />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3 font-sans">
                <div className="flex items-center gap-2" role="status" aria-live="polite">
                  <div
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  />
                  <span id="scryb-panel-title" className="text-xs tracking-wide text-zinc-400">
                    AI API Connected {/* TODO(ash): connect to actual API */}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    aria-hidden="true"
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors duration-500",
                      viewState === "generating" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
                      viewState === "success" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                      "bg-zinc-600"
                    )}
                  />
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {viewState === "generating" ? "Processing" : viewState === "success" ? "Done" : "Ready"}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <AnimatePresence mode="wait">
                  {viewState === "idle" || viewState === "generating" ? (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-6"
                    >
                      <div className="space-y-2">
                        <h3 className="text-2xl tracking-tight text-white">
                          <em>Generate Documentation</em> 
                        </h3>
                        <p className="text-sm leading-relaxed text-zinc-400">
                          Transform your current workflow into comprehensive documentation with one click.
                        </p>
                      </div>

                      <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                        <Lightbulb className="absolute left-3 top-4 h-4.5 w-4.5 text-amber-500/60" aria-hidden="true" />
                        <p className="pl-5 font-sans text-xs italic leading-relaxed text-zinc-400">
                          {hint}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        className="group h-11 w-full rounded-2xl border-white/[0.1] bg-white/[0.05] text-zinc-200 transition-all hover:border-white/[0.15] hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
                        onClick={handleGenerate}
                        disabled={viewState === "generating"}
                      >
                        {viewState === "generating" ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            <span className="text-sm">Synthesizing...</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <SquarePen className="h-4 w-4" aria-hidden="true" />
                            <span className="text-sm font-sans">Generate Docs</span>
                            <ArrowRight className="h-4 w-4 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100" aria-hidden="true" />
                          </div>
                        )}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="space-y-6"
                    >
                      <div className="flex flex-col items-center justify-center py-1 text-center">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                          <Check className="h-7 w-7 text-emerald-400" aria-hidden="true" />
                        </div>
                        <h3 className="text-xl text-zinc-100">
                          Ready to Download
                        </h3>
                        <p className="pt-2.5 text-sm text-zinc-500">Your documentation has been successfully generated.</p>
                      </div>

                      <div className="group flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/[0.08]">
                            <FileText className="h-5 w-5 text-zinc-400" aria-hidden="true" />
                          </div>
                          <div className="flex flex-col items-start gap-0.5 font-sans">
                            <span className="text-sm text-zinc-200 group-hover:text-white">workflow-docs.md</span>
                            <span className="text-xs text-zinc-500">2.4 KB • Markdown</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="Download documentation"
                          className="p-2 text-zinc-500 transition-colors hover:text-zinc-200"
                        >
                          <Download className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="flex gap-3 font-sans">
                        <Button
                          variant="outline"
                          className="flex-1 gap-2 rounded-2xl border-white/[0.1] bg-white/[0.05] text-zinc-300 hover:border-white/[0.15] hover:bg-white/[0.08] hover:text-zinc-100"
                          onClick={resetView}
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                          Back
                        </Button>
                        <button
                          type="button"
                          className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm transition-colors"
                          style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#18181b' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.9)'; }}
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          Open
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        layout
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close Scryb documentation panel" : "Open Scryb documentation panel"}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          "group relative flex cursor-pointer items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isOpen
            ? "h-14 w-[360px] justify-between rounded-2xl border border-white/[0.08] bg-black/40 px-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
            : "h-20 w-20"
        )}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div 
              key="full-logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Image
                  src="/icons/scryb_logo_white.svg"
                  alt="Scryb"
                  width={90}
                  height={28}
                  className="h-7 w-auto shrink-0 translate-y-[2.5px] opacity-90"
                />
                <div className="h-5 w-px shrink-0 bg-white/10" />
                <span className="text-[10px] font-medium leading-none tracking-widest text-zinc-500">DOCUMENTATION</span>
              </div>

              <div
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-zinc-500 transition-all hover:bg-white/[0.1] hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </div>
            </motion.div>
          ) : (

            <motion.div
              key="compact-logo"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="relative flex items-center justify-center"
            >
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              
              <div className="relative transition-all duration-300 ease-out group-hover:scale-110 group-hover:drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]">
                <Image
                  src="/icons/scryb_logo_compact_white.svg"
                  alt="Scryb AI"
                  width={56}
                  height={56}
                  className="h-14 w-14 opacity-90 transition-all duration-300 group-hover:opacity-100"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
