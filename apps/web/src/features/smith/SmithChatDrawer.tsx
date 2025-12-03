"use client";

import { FormEvent } from "react";
import { Sparkles, Loader2, Send, Bot, User2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type SmithChatMessage = {
  role: "user" | "smith";
  content: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: SmithChatMessage[];
  input: string;
  onInputChange: (next: string) => void;
  onSend: (content: string) => void;
  isSending: boolean;
  trace?: string[] | null;
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
  trace,
  showTrace = false,
  onToggleTrace,
}: Props) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;
    onSend(input.trim());
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-xl flex-col gap-4 border-l border-border/60 bg-gradient-to-br from-background to-muted/30"
      >
        <SheetHeader className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
            Smith Agent
          </div>
          <SheetTitle className="text-lg font-semibold">
            Describe changes, Smith will update the canvas
          </SheetTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showTrace}
              onChange={(e) => onToggleTrace?.(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border/70 text-primary focus-visible:outline-none"
            />
            Include reasoning (may be slower)
          </label>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto rounded-xl border border-border/60 bg-background/70 p-3">
          <div className="space-y-3 text-sm leading-relaxed">
            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/50 bg-muted/40 p-3 text-muted-foreground">
                Give Smith instructions like “Add a trigger and HTTP call” or “Branch if status is not 200 then send email”.
              </div>
            )}
            {isSending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Smith is thinking...
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}-${msg.content.slice(0, 8)}`}
                className={`flex items-start gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "smith" && (
                  <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </span>
                )}
                <div
                  className={`max-w-[75%] whitespace-pre-wrap rounded-2xl border px-3 py-2 shadow-sm ${
                    msg.role === "user"
                      ? "border-primary/30 bg-primary/10 text-foreground"
                      : "border-border/60 bg-muted/40 text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <span className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-muted-foreground">
                    <User2 className="h-4 w-4" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Ask Smith to add, edit, or rearrange nodes..."
            className="min-h-[110px] resize-none"
          />
          {trace && trace.length > 0 && (
            <details className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-semibold text-foreground">
                View Smith reasoning
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md bg-background/80 p-2">
                <ul className="space-y-1 pl-4">
                  {trace.map((line, idx) => (
                    <li key={`${line}-${idx}`}>
                      {idx + 1}. {line}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Smith sees your current workflow and returns a fully wired update.
            </div>
            <Button type="submit" disabled={isSending || !input.trim()} className="gap-2">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
