"use client";

import { FormEvent, useEffect, useRef } from "react";
import Image from "next/image";
import { Loader2, SendHorizontal, Sparkles, Bot, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

export type SmithChatMessage = {
  role: "user" | "smith";
  content: string;
  trace?: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: SmithChatMessage[];
  input: string;
  onInputChange: (next: string) => void;
  onSend: (content: string) => void;
  isSending: boolean;
  showTrace?: boolean;
  onToggleTrace?: (next: boolean) => void;
};

export function SmithChatDrawer({
  open,
  onOpenChange,
  messages,
  input,
  onInputChange,
  onSend,
  isSending,
  showTrace = false,
  onToggleTrace,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      setTimeout(scrollToBottom, 100);
    }
  }, [open, messages, isSending]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;
    onSend(input.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Stop propagation to prevent canvas shortcuts (like Backspace for delete) from firing while typing
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleDrawerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Stop propagation for copy/paste/select-all to prevent canvas from intercepting
    if ((e.ctrlKey || e.metaKey) && ["c", "v", "a", "x"].includes(e.key.toLowerCase())) {
      e.stopPropagation();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-md flex-col gap-0 border-l border-border/40 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-[500px] focus-visible:outline-none select-text"
        onKeyDown={handleDrawerKeyDown}
      >
        <div className="relative z-10 flex shrink-0 flex-col items-center justify-center border-b border-border/40 bg-background/80 py-8 backdrop-blur-md select-none">
          <div className="mb-3 flex h-12 w-auto items-center justify-center">
            <Image
              src="/icons/smith_logo_white.svg"
              alt="Smith AI"
              width={160}
              height={48}
              className="h-12 w-auto"
              priority
            />
          </div>
          <SheetTitle className="sr-only">Smith AI</SheetTitle>
          <p className="text-xs font-medium text-muted-foreground/80">Workflow Architect</p>
        </div>

        <div className="relative flex-1 overflow-y-auto p-4 scrollbar-none">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-500/5 via-transparent to-transparent opacity-50 pointer-events-none" />
            
            <div className="flex flex-col gap-6 py-4">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center opacity-60 select-none">
                    <div className="mb-4 rounded-full bg-primary/5 p-4 ring-1 ring-primary/10">
                        <Sparkles className="h-8 w-8 text-primary/60" />
                    </div>
                    <h3 className="mb-2 text-sm font-medium text-foreground">Ready to build</h3>
                    <p className="max-w-[260px] text-xs text-muted-foreground">
                        Describe your workflow logic, and I&apos;ll handle the nodes and connections.
                    </p>
                </div>
            )}

            <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                <motion.div
                    key={`${msg.role}-${idx}`}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                    "flex w-full gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                >
                    {msg.role === "smith" && (
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 select-none">
                            <Bot className="h-5 w-5 opacity-80" />
                        </div>
                    )}

                    <div className="flex flex-col gap-2 max-w-[85%]">
                        <div className={cn(
                            "relative rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm select-text",
                            msg.role === "user"
                                ? "bg-gradient-to-tr from-primary to-primary/90 text-primary-foreground rounded-br-sm selection:bg-white selection:text-primary"
                                : "bg-muted/50 text-foreground border border-border/50 rounded-bl-sm backdrop-blur-sm selection:bg-primary/20 selection:text-foreground"
                        )}>
                            {msg.content}
                        </div>

                        {msg.role === "smith" && msg.trace && msg.trace.length > 0 && (
                            <details className="group rounded-lg border border-border/40 bg-muted/20 [&_summary::-webkit-details-marker]:hidden">
                                <summary className="flex cursor-pointer items-center gap-2 p-2 text-xs font-medium text-muted-foreground hover:text-foreground select-none">
                                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                                    View Reasoning Steps
                                </summary>
                                <div className="border-t border-border/40 bg-background/40 px-3 py-2">
                                    <ul className="space-y-1.5">
                                        {msg.trace.map((step, stepIdx) => (
                                            <li key={stepIdx} className="flex gap-2 text-[11px] text-muted-foreground/80 select-text">
                                                <span className="font-mono opacity-50 select-none">{stepIdx + 1}.</span>
                                                <span>{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </details>
                        )}
                    </div>
                </motion.div>
                ))}
            </AnimatePresence>

            {isSending && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 select-none"
                >
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                         <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                        <span className="animate-pulse">{showTrace ? "Reasoning" : "Thinking"}</span>
                        <span className="animate-bounce delay-75">.</span>
                        <span className="animate-bounce delay-150">.</span>
                        <span className="animate-bounce delay-300">.</span>
                    </div>
                </motion.div>
            )}
             <div ref={messagesEndRef} />
            </div>
        </div>

        <div className="shrink-0 border-t border-border/40 bg-background/80 px-4 py-4 backdrop-blur-md">
            <div className={cn(
                "relative flex flex-col gap-2 rounded-xl border border-input bg-background px-3 py-3 shadow-sm transition-all",
                "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary"
            )}>
                <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Smith to add, edit, or rearrange nodes..."
                    className="min-h-[40px] w-full resize-none border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                    rows={1}
                    style={{ maxHeight: "150px" }}
                />
                <div className="flex items-center justify-between pt-2">
                    <label 
                        className={cn(
                            "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors select-none",
                            showTrace ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                        )}
                        title="Show detailed reasoning steps"
                    >
                        <input
                            type="checkbox"
                            checked={showTrace}
                            onChange={(e) => onToggleTrace?.(e.target.checked)}
                            className="hidden"
                        />
                        <Sparkles className="h-3 w-3" />
                        {showTrace ? "Reasoning On" : "Reasoning Off"}
                    </label>
                    
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-7 w-7 !p-0 rounded-lg transition-all shrink-0 disabled:opacity-100",
                            input.trim() ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" : "bg-muted/60 text-muted-foreground"
                        )}
                        onClick={() => onSend(input.trim())}
                        disabled={isSending || !input.trim()}
                    >
                        <SendHorizontal className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
            <div className="mt-2 text-center text-[10px] text-muted-foreground/40 select-none">
                Smith can make mistakes. Verify the generated workflow.
            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}