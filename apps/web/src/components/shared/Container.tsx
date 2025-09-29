"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/cn";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  widthClassName?: string;
}

export function Container({
  asChild,
  className,
  widthClassName = "max-w-6xl",
  ...props
}: ContainerProps) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      className={cn("mx-auto w-full px-6 sm:px-8", widthClassName, className)}
      {...props}
    />
  );
}
