"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import type { TodoItem } from "@/lib/api/smith";

type Props = {
  todos: TodoItem[];
  isSending: boolean;
};

export function SmithTodoPanel({ todos }: Props) {
  const [open, setOpen] = useState(true);

  const doneCount = todos.filter((t) => t.status === "done").length;
  const total = todos.length;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // The agent now reports real statuses via the prebuilt `write_todos` tool
  // (pending / in_progress / completed -> done), so trust them directly.
  function getDisplayStatus(todo: TodoItem): "pending" | "in_progress" | "done" {
    return todo.status;
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="shrink-0 border-b border-border/40 bg-muted/20"
    >
      {/* Header row */}
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-foreground/80 tracking-wide uppercase">
            Plan
          </span>
          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
            {doneCount}/{total}
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        {/* Progress bar */}
        <div className="mx-4 mb-2.5 h-0.5 rounded-full bg-border/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Todo list */}
        <ul className="flex flex-col gap-0.5 px-4 pb-3">
          <AnimatePresence initial={false}>
            {todos.map((todo) => {
              const displayStatus = getDisplayStatus(todo);
              return (
                <motion.li
                  key={todo.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-start gap-2.5 py-1"
                >
                  {/* Status icon */}
                  <div className="mt-0.5 shrink-0">
                    {displayStatus === "done" && (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20"
                      >
                        <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3} />
                      </motion.div>
                    )}
                    {displayStatus === "in_progress" && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                    {displayStatus === "pending" && (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                    )}
                  </div>

                  {/* Title + optional description */}
                  <div className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-xs leading-relaxed transition-all duration-300",
                        displayStatus === "done"
                          ? "text-muted-foreground/50 line-through"
                          : displayStatus === "in_progress"
                            ? "text-foreground font-medium"
                            : "text-muted-foreground/70",
                      )}
                    >
                      {todo.title}
                    </span>
                    {todo.description && displayStatus !== "done" && (
                      <span className="block text-[10px] text-muted-foreground/50 leading-snug mt-0.5">
                        {todo.description}
                      </span>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
