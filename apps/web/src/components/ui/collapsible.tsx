"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

interface CollapsibleContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null);

function useCollapsible() {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error("Collapsible components must be used within a Collapsible");
  }
  return context;
}

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

function Collapsible({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  className,
  children,
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
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
    <CollapsibleContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  );
}

interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ className, children, asChild, onClick, ...props }, ref) => {
    const { open, onOpenChange } = useCollapsible();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onOpenChange(!open);
      onClick?.(e);
    };

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<{ onClick?: typeof handleClick }>, {
        onClick: handleClick,
      });
    }

    return (
      <button
        ref={ref}
        type="button"
        className={className}
        onClick={handleClick}
        aria-expanded={open}
        {...props}
      >
        {children}
      </button>
    );
  }
);
CollapsibleTrigger.displayName = "CollapsibleTrigger";

interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {
  forceMount?: boolean;
}

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ className, children, forceMount, ...props }, ref) => {
    const { open } = useCollapsible();

    if (!open && !forceMount) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden transition-all",
          open ? "animate-in fade-in" : "animate-out fade-out",
          className
        )}
        hidden={!open && !forceMount}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
