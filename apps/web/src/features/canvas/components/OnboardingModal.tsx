"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SpotlightOverlay, type SpotlightTarget } from "./SpotlightOverlay";
import { tryParseGraphFromText } from "../lib/graphIO";
import type { CanvasNode } from "../types";
import type { Edge } from "@xyflow/react";

type OnboardingModalProps = {
  open: boolean;
  step: number;
  onStepChange: (step: number) => void;
  onClose: () => void;
  onCreateExample: (nodes: CanvasNode[], edges: Edge[]) => void;
  stepCompleted?: boolean;
};

type TourStep = {
  target: SpotlightTarget;
  title: string;
  description: string;
  tip?: string;
  task: string;
  imageBase: string;
  showInCarousel?: boolean;
};

const TOUR_STEPS: TourStep[] = [
  {
    target: "library",
    title: "Start with a Trigger",
    description:
      "Open the Library panel on the left and drag a Trigger node onto the canvas. The Trigger is the entry point of every workflow, it kicks off execution when activated.",
    tip: "Press T to instantly drop a Trigger node at your cursor position.",
    task: "Drag a Trigger node from the Library onto the canvas.",
    imageBase: "/onboarding/library",
  },
  {
    target: "canvas",
    title: "Build the Flow",
    description:
      "Drag a second node onto the canvas. It can be an HTTP node, log entry, or anything! Then wire them together: drag from the output handle on the right side of the Trigger to the input handle on the left side of the new node.",
    tip: "Nodes are grouped conveniently in the library pane!",
    task: "Add a second node, then connect it to the Trigger.",
    imageBase: "/onboarding/edges",
  },
  {
    target: "inspector",
    title: "Configure in the Inspector",
    description:
      "Click any node to open the Inspector panel on the right. Set parameters, credentials, and inputs there. Double-click a node to expand the full dialog.",
    tip: "Use the variable picker via '+' to access node data.",
    task: "Click any node on the canvas to open the Inspector.",
    imageBase: "/onboarding/inspector",
  },
  {
    target: "save",
    title: "Save Your Workflow",
    description:
      "Hit the Save button in the toolbar to persist your workflow before running. Saving creates a version you can return to at any time.",
    task: "Click Save in the toolbar to save your workflow.",
    imageBase: "/onboarding/run",
    showInCarousel: false,
  },
  {
    target: "toolbar",
    title: "Run Your Workflow",
    description:
      "Hit the Run button in the toolbar to execute the workflow. Nodes light up in real time as they process, and outputs appear instantly in the Inspector.",
    tip: "Execution history is saved! Use the dropdown to replay any past run.",
    task: "Click the Run button in the toolbar to execute the workflow.",
    imageBase: "/onboarding/run",
  },
];

const EXAMPLE_WORKFLOW_JSON = JSON.stringify({
  nodes: [
    {
      id: "25d9b8ff-fe90-40ad-bb7f-f71a96a88764",
      type: "trigger",
      position: {
        x: 98.18692902319037,
        y: 51.858046380885455,
      },
      data: {
        label: "Trigger",
      },
      measured: {
        width: 160,
        height: 40,
      },
      selected: false,
    },
    {
      id: "5fa65665-763b-4cf7-9e94-b0da280c6792",
      type: "http",
      position: {
        x: 378.1869290231904,
        y: 35.858046380885455,
      },
      data: {
        label: "fortune_cookie",
        method: "GET",
        url: "https://api.github.com/zen",
        timeout: 30,
        retry: 0,
        retry_delay: 0,
        raise_on_status: "4xx,5xx",
      },
      measured: {
        width: 220,
        height: 76,
      },
      selected: false,
    },
    {
      id: "3d234f4a-ddd7-4d8f-aae5-97e6413f8f82",
      type: "log",
      position: {
        x: 718.1869290231904,
        y: 39.858046380885455,
      },
      data: {
        label: "Log",
        message:
          "the cookie server is $fortune_cookie.status_text\nand your fortune cookie says: $fortune_cookie.body",
        level: "info",
      },
      measured: {
        width: 220,
        height: 76,
      },
      selected: false,
      dragging: false,
    },
  ],
  edges: [
    {
      id: "9cb2c18a-9b3b-4c3e-bd94-37dfac249317",
      source: "25d9b8ff-fe90-40ad-bb7f-f71a96a88764",
      target: "5fa65665-763b-4cf7-9e94-b0da280c6792",
      type: "default",
    },
    {
      id: "a85e3af0-b8aa-4a56-9bc6-741b7ecffe56",
      source: "5fa65665-763b-4cf7-9e94-b0da280c6792",
      target: "3d234f4a-ddd7-4d8f-aae5-97e6413f8f82",
      type: "default",
    },
  ],
});

function useTheme(): "dark" | "light" {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const check = () => {
      const cl = document.documentElement.classList;
      if (cl.contains("dark")) {
        setIsDark(true);
        return;
      }
      if (cl.contains("light")) {
        setIsDark(false);
        return;
      }
      setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    };
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", check);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", check);
    };
  }, []);
  return isDark ? "dark" : "light";
}

const CAROUSEL_STEPS = TOUR_STEPS.filter((s) => s.showInCarousel !== false);
const TOTAL_PAGES = 1 + CAROUSEL_STEPS.length;

const imgVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

const contentVariants = {
  enter: (d: number) => ({ x: d * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: -d * 28, opacity: 0 }),
};

export function OnboardingModal({
  open,
  step,
  onStepChange,
  onClose,
  onCreateExample,
  stepCompleted,
}: OnboardingModalProps) {
  const isWelcome = step === 0;
  const isTour = step >= 1 && step <= TOUR_STEPS.length;
  const isCTA = step === TOUR_STEPS.length + 1;
  const tourIndex = step - 1;

  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const theme = useTheme();

  useEffect(() => {
    if (open && isWelcome) setPage(0);
  }, [open, isWelcome]);

  function goTo(next: number) {
    if (next === page) return;
    setDir(next > page ? 1 : -1);
    setPage(next);
  }

  const heroSrc =
    page === 0
      ? `/onboarding/bg_${theme}.png`
      : `${CAROUSEL_STEPS[page - 1].imageBase}_${theme}.png`;

  function handleCreateExample() {
    const graph = tryParseGraphFromText(EXAMPLE_WORKFLOW_JSON);
    if (graph) {
      onCreateExample(graph.nodes as CanvasNode[], graph.edges as Edge[]);
    }
    onClose();
  }

  return (
    <>
      <Dialog open={open && isWelcome} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Welcome to Rune Canvas</DialogTitle>

          <div className="relative h-56 w-full overflow-hidden">
            <AnimatePresence initial={false} mode="sync">
              <motion.div
                key={heroSrc}
                className="absolute inset-0"
                variants={imgVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <Image
                  src={heroSrc}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 36rem, 100vw"
                  className="object-cover object-center"
                  priority={open && isWelcome}
                />
              </motion.div>
            </AnimatePresence>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-card" />
            {page > 0 && (
              <div className="absolute left-4 top-4 rounded-full bg-black/35 px-2.5 py-1 backdrop-blur-sm">
                <span className="font-mono text-[10px] text-white/60">
                  {page} / {CAROUSEL_STEPS.length}
                </span>
              </div>
            )}
          </div>

          <div className="relative overflow-hidden">
            <AnimatePresence initial={false} custom={dir} mode="wait">
              <motion.div
                key={page}
                custom={dir}
                variants={contentVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                className="px-7 pb-2 pt-5"
              >
                {page === 0 ? (
                  <>
                    <h2 className="font-display text-[28px] font-normal leading-tight text-foreground">
                      Welcome to your <em>Canvas</em>
                    </h2>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                      Build powerful workflow automations visually; connect nodes, set parameters,
                      and run in seconds. Let&apos;s help you get started!
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="font-display text-[26px] font-normal leading-tight text-foreground">
                      {CAROUSEL_STEPS[page - 1].title}
                    </h2>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                      {CAROUSEL_STEPS[page - 1].description}
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/50 px-6 py-3.5">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === page
                      ? "h-1.5 w-4 bg-primary"
                      : "h-1.5 w-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40",
                  )}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {page === 0 ? (
                <button
                  onClick={onClose}
                  className="text-xs text-muted-foreground/40 transition-colors hover:text-muted-foreground/70"
                >
                  Skip for now
                </button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goTo(page - 1)}
                  className="h-7 w-7 p-0 text-muted-foreground/70"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              )}

              {page < TOTAL_PAGES - 1 ? (
                <Button size="sm" onClick={() => goTo(page + 1)}>
                  Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onStepChange(TOUR_STEPS.length + 1)}
                  >
                    View Example Workflow
                  </Button>
                  <Button size="sm" onClick={() => onStepChange(1)}>
                    Take the Tour →
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {open && isTour && (
          <SpotlightOverlay
            target={TOUR_STEPS[tourIndex].target}
            step={Math.min(step, CAROUSEL_STEPS.length)}
            totalSteps={CAROUSEL_STEPS.length}
            title={TOUR_STEPS[tourIndex].title}
            description={TOUR_STEPS[tourIndex].description}
            tip={TOUR_STEPS[tourIndex].tip}
            task={TOUR_STEPS[tourIndex].task}
            completed={stepCompleted}
            onNext={() => onStepChange(step + 1)}
            onBack={() => onStepChange(step - 1)}
            onSkip={onClose}
            onOverview={() => onStepChange(0)}
          />
        )}
      </AnimatePresence>

      <Dialog open={open && isCTA} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogTitle className="sr-only">Try a Quick Example</DialogTitle>

          <div className="relative h-44 w-full overflow-hidden">
            <Image
              src={`/onboarding/run_${theme}.png`}
              alt=""
              fill
              sizes="(min-width: 640px) 28rem, 100vw"
              className="object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-card" />
          </div>

          <div className="px-7 pb-7 pt-5">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">
              Quick Start
            </p>
            <h2 className="font-display text-[22px] font-normal leading-tight text-foreground">
              Try a working example 🥠
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              What does your fortune cookie say? Try out this starting template to find out!
            </p>

            <div className="mt-4 flex items-center gap-1.5 border-t border-border/40 pt-4 text-[11px] text-muted-foreground/40">
              <span>Trigger</span>
              <span className="text-muted-foreground/20">→</span>
              <span>HTTP GET</span>
              <span className="text-muted-foreground/20">→</span>
              <span>Log</span>
              <span className="ml-auto">3 nodes</span>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <Button onClick={handleCreateExample} className="w-full font-medium">
                Load Example Workflow
              </Button>
              <Button variant="ghost" onClick={onClose} className="w-full text-muted-foreground/60">
                Start from Scratch
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
