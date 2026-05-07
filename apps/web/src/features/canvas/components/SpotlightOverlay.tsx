"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Lightbulb, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

export type SpotlightTarget = "library" | "canvas" | "inspector" | "save" | "toolbar";

type Rect = { x: number; y: number; width: number; height: number };
type Side = "right" | "left" | "bottom" | "center";

export type SpotlightOverlayProps = {
  target: SpotlightTarget;
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  tip?: string;
  task?: string;
  completed?: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onOverview: () => void;
};

const PAD = 12;
const RADIUS = 14;
const TW = 328;
const GAP = 18;

function measureTarget(target: SpotlightTarget): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-onboarding="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.left < 0) {
    return { x: 4, y: Math.max(60, r.top), width: 40, height: Math.min(r.height, window.innerHeight - 80) };
  }
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

function getSide(target: SpotlightTarget): Side {
  switch (target) {
    case "library":   return "right";
    case "inspector": return "left";
    case "save":
    case "toolbar":   return "bottom";
    case "canvas":    return "center";
  }
}

function getTooltipPos(rect: Rect, side: Side): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sx = rect.x - PAD, sy = rect.y - PAD;
  const sw = rect.width + PAD * 2, sh = rect.height + PAD * 2;

  switch (side) {
    case "right":
      return {
        x: Math.min(sx + sw + GAP, vw - TW - 8),
        y: Math.max(8, Math.min(sy + sh / 2 - 140, vh - 340)),
      };
    case "left":
      return {
        x: Math.max(8, sx - TW - GAP),
        y: Math.max(8, Math.min(sy + sh / 2 - 140, vh - 340)),
      };
    case "bottom":
      return {
        x: Math.max(8, Math.min(sx, vw - TW - 8)),
        y: Math.min(sy + sh + GAP, vh - 340),
      };
    case "center":
      return {
        x: Math.max(8, vw / 2 - TW / 2),
        y: Math.max(8, sy + 52),
      };
  }
}

const spring = { type: "spring" as const, stiffness: 300, damping: 38 };

export function SpotlightOverlay({
  target,
  step,
  totalSteps,
  title,
  description,
  tip,
  task,
  completed = true,
  onNext,
  onBack,
  onSkip,
  onOverview,
}: SpotlightOverlayProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const lastRectRef = useRef<Rect | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setRect(null);
    lastRectRef.current = null;

    const loop = () => {
      const r = measureTarget(target);
      if (r) {
        const prev = lastRectRef.current;
        if (!prev || prev.x !== r.x || prev.y !== r.y || prev.width !== r.width || prev.height !== r.height) {
          lastRectRef.current = r;
          setRect(r);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  const side = getSide(target);
  const tp = rect ? getTooltipPos(rect, side) : null;

  const sx = rect ? rect.x - PAD : -9999;
  const sy = rect ? rect.y - PAD : -9999;
  const sw = rect ? rect.width + PAD * 2 : 1;
  const sh = rect ? rect.height + PAD * 2 : 1;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[39]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <mask id="onboarding-mask">
            <rect width="100%" height="100%" fill="white" />
            <motion.rect
              animate={{ x: sx, y: sy, width: sw, height: sh }}
              transition={spring}
              rx={RADIUS}
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#onboarding-mask)" />
        <motion.rect
          animate={{ x: sx, y: sy, width: sw, height: sh }}
          transition={spring}
          rx={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="1"
        />
      </svg>

      <AnimatePresence mode="wait">
        {tp && (
          <motion.div
            key={`tip-${target}`}
            className="pointer-events-auto absolute"
            initial={{ opacity: 0, y: tp.y + 8, scale: 0.98 }}
            animate={{ opacity: 1, y: tp.y, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ left: tp.x, width: TW }}
          >
            <div
              className="overflow-hidden rounded-2xl border border-white/[0.07] bg-card/90 backdrop-blur-2xl"
              style={{
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 1px rgba(0,0,0,0.3), 0 20px 60px rgba(0,0,0,0.65), 0 4px 16px rgba(0,0,0,0.4)",
              }}
            >
              <div className="p-5">
                <div className="mb-3.5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "block rounded-full transition-all duration-300",
                          i + 1 === step
                            ? "h-1.5 w-4 bg-primary"
                            : "h-1.5 w-1.5 bg-muted-foreground/20",
                        )}
                      />
                    ))}
                  </div>
                  <button
                    onClick={onSkip}
                    className="shrink-0 text-[11px] text-muted-foreground/40 transition-colors hover:text-muted-foreground/70"
                  >
                    Exit tour
                  </button>
                </div>

                <h3 className="mb-2 font-display text-[18px] font-normal leading-snug text-foreground">
                  {title}
                </h3>

                <p className="text-[13px] leading-[1.6] text-muted-foreground">
                  {description}
                </p>

                {tip && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
                    <Lightbulb className="mt-px h-3 w-3 shrink-0 text-primary/60" />
                    <p className="text-[11px] leading-relaxed text-muted-foreground/80">{tip}</p>
                  </div>
                )}

                {task && (
                  <div className="mt-3">
                    <AnimatePresence mode="wait">
                      {completed ? (
                        <motion.div
                          key="done"
                          initial={{ opacity: 0, y: -3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2"
                        >
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400/70" />
                          <span className="text-[11px] text-emerald-400/70">Step complete — continue when ready</span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="task"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2"
                        >
                          <MousePointerClick className="mt-px h-3 w-3 shrink-0 text-primary/50" />
                          <span className="text-[11px] leading-relaxed text-primary/70">{task}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-3.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onOverview}
                    className="h-7 px-2 text-[11px] text-muted-foreground/50 hover:text-muted-foreground"
                  >
                    Overview
                  </Button>

                  <div className="flex items-center gap-1.5">
                    {step > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onBack}
                        className="h-7 w-7 p-0 text-muted-foreground/70"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={onNext}
                      disabled={!completed}
                      className="h-7 px-3.5 text-[11px] font-medium"
                    >
                      {step === totalSteps ? "Finish" : "Next"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
