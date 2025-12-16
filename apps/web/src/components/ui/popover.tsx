"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface PopoverContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopover() {
  const context = React.useContext(PopoverContext);
  if (!context) {
    throw new Error("Popover components must be used within a Popover");
  }
  return context;
}

interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Popover({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange]
  );

  return (
    <PopoverContext.Provider value={{ open, onOpenChange: handleOpenChange, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
}

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ className, children, asChild, onClick, ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = usePopover();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onOpenChange(!open);
      onClick?.(e);
    };

    const combinedRef = (node: HTMLButtonElement | null) => {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
      (triggerRef as React.RefObject<HTMLButtonElement | null> & { current: HTMLButtonElement | null }).current = node;
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ onClick?: typeof handleClick; ref?: typeof combinedRef }>, {
        onClick: handleClick,
        ref: combinedRef,
      });
    }

    return (
      <button
        ref={combinedRef}
        type="button"
        className={className}
        onClick={handleClick}
        aria-expanded={open}
        aria-haspopup="dialog"
        {...props}
      >
        {children}
      </button>
    );
  }
);
PopoverTrigger.displayName = "PopoverTrigger";

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, children, align = "center", sideOffset = 4, ...props }, ref) => {
    const { open, onOpenChange, triggerRef } = usePopover();
    const contentRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      if (!open) return;

      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        const isInsideContent = contentRef.current?.contains(target);
        const isInsideTrigger = triggerRef.current?.contains(target);

        if (!isInsideContent && !isInsideTrigger) {
          onOpenChange(false);
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onOpenChange(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside, true);
      document.addEventListener("keydown", handleEscape, true);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside, true);
        document.removeEventListener("keydown", handleEscape, true);
      };
    }, [open, onOpenChange, triggerRef]);

    if (!open) return null;

    const alignmentClasses = {
      start: "left-0",
      center: "left-1/2 -translate-x-1/2",
      end: "right-0",
    };

    return (
      <div
        ref={(node) => {
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
          contentRef.current = node;
        }}
        className={cn(
          "absolute z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
          "animate-in fade-in-0 zoom-in-95",
          alignmentClasses[align],
          className
        )}
        style={{ top: `calc(100% + ${sideOffset}px)` }}
        role="dialog"
        {...props}
      >
        {children}
      </div>
    );
  }
);
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent };
