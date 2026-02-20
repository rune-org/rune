"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";


const AlertDialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ children, asChild, ...props }, ref) => {
  const [open, setOpen] = React.useState(false);

  // We need to use context to communicate with the parent AlertDialog
  // For now, use a simpler approach - wrap in provider
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
      onClick: (e: React.MouseEvent) => {
        (children.props as React.HTMLAttributes<HTMLElement>).onClick?.(e as React.MouseEvent<HTMLElement>);
        // Trigger will be handled by Dialog's trigger
      },
    });
  }

  return (
    <button ref={ref} {...props}>
      {children}
    </button>
  );
});
AlertDialogTrigger.displayName = "AlertDialogTrigger";

// Simple context for alert dialog open state
interface AlertDialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(null);

function AlertDialogRoot({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}) {
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
    <AlertDialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {children}
      </Dialog>
    </AlertDialogContext.Provider>
  );
}

const AlertDialogTriggerSimple = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ children, className, asChild, onClick, ...props }, ref) => {
  const context = React.useContext(AlertDialogContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    context?.onOpenChange(true);
    onClick?.(e);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: typeof handleClick }>, {
      onClick: handleClick,
    });
  }

  return (
    <button ref={ref} className={className} onClick={handleClick} {...props}>
      {children}
    </button>
  );
});
AlertDialogTriggerSimple.displayName = "AlertDialogTrigger";

const AlertDialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <DialogContent
    ref={ref}
    className={cn("sm:max-w-[425px]", className)}
    {...props}
  >
    {children}
  </DialogContent>
));
AlertDialogContent.displayName = "AlertDialogContent";

const AlertDialogHeader = DialogHeader;
const AlertDialogFooter = DialogFooter;
const AlertDialogTitle = DialogTitle;
const AlertDialogDescription = DialogDescription;

const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const context = React.useContext(AlertDialogContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    context?.onOpenChange(false);
    onClick?.(e);
  };

  return (
    <Button
      ref={ref}
      className={cn(buttonVariants(), className)}
      onClick={handleClick}
      {...props}
    />
  );
});
AlertDialogAction.displayName = "AlertDialogAction";

const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const context = React.useContext(AlertDialogContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    context?.onOpenChange(false);
    onClick?.(e);
  };

  return (
    <Button
      ref={ref}
      variant="outline"
      className={cn("mt-2 sm:mt-0", className)}
      onClick={handleClick}
      {...props}
    />
  );
});
AlertDialogCancel.displayName = "AlertDialogCancel";

// Export with AlertDialogRoot as the main AlertDialog
export {
  AlertDialogRoot as AlertDialog,
  AlertDialogTriggerSimple as AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
