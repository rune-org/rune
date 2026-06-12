"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { ChatGPTIcon, ClaudeIcon, LinkArrowIcon } from "nextra/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DocsCopyPage({ sourceCode }: { sourceCode: string }) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sourceCode);
    setIsCopied(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
  };

  const openInAssistant = (assistant: "chatgpt" | "claude") => {
    const url =
      assistant === "chatgpt" ? "chatgpt.com/?hints=search&prompt" : "claude.ai/new?q";
    const query = `Read from ${location.href} so I can ask questions about it.`;
    window.open(`https://${url}=${encodeURIComponent(query)}`, "_blank");
  };

  return (
    <div className="float-end ms-4 mb-2 inline-flex items-stretch overflow-hidden rounded-md border border-border/70">
      <button
        type="button"
        onClick={handleCopy}
        className="flex cursor-pointer items-center gap-2 ps-3 pe-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
      >
        {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {isCopied ? "Copied" : "Copy page"}
      </button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          className="flex cursor-pointer items-center border-s border-border/70 px-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="More copy options"
        >
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={10}>
          <DropdownMenuItem onSelect={handleCopy} className="cursor-pointer gap-3">
            <Copy className="size-4 shrink-0" />
            <span className="flex flex-col">
              <span className="font-medium">Copy page</span>
              <span className="text-xs text-muted-foreground">
                Copy page as Markdown for LLMs
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => openInAssistant("chatgpt")}
            className="cursor-pointer gap-3"
          >
            <ChatGPTIcon width="16" className="shrink-0" />
            <span className="flex flex-col">
              <span className="flex items-center gap-1 font-medium">
                Open in ChatGPT <LinkArrowIcon height="1em" />
              </span>
              <span className="text-xs text-muted-foreground">
                Ask questions about this page
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => openInAssistant("claude")}
            className="cursor-pointer gap-3"
          >
            <ClaudeIcon width="16" className="shrink-0" />
            <span className="flex flex-col">
              <span className="flex items-center gap-1 font-medium">
                Open in Claude <LinkArrowIcon height="1em" />
              </span>
              <span className="text-xs text-muted-foreground">
                Ask questions about this page
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
