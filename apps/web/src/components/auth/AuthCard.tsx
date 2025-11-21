"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface AuthCardProps {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AuthCard({
  title,
  description,
  footer,
  children,
  className,
}: AuthCardProps) {
  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/20 blur-[100px] rounded-full opacity-50 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={cn(
          "relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 backdrop-blur-xl shadow-2xl",
          className
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        <div className="relative z-10 p-8 md:p-10 flex flex-col gap-6">
          <div className="space-y-2 text-center">
            <h1 
              className="text-3xl font-bold font-serif tracking-tight text-white"
              style={{ fontFamily: 'var(--font-playfair)' }}
            >
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>
          
          {children}

          {footer && (
            <div className="text-center text-sm text-muted-foreground pt-2">
              {footer}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}