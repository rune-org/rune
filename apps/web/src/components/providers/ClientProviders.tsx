"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppStateProvider } from "@/lib/state";
import { AuthProvider } from "@/lib/auth";
import { setupClientInterceptors } from "@/lib/api/setupClientInterceptors";

export function RootProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    setupClientInterceptors();
  }, []);

  return (
    <AuthProvider>
      <AppStateProvider>{children}</AppStateProvider>
    </AuthProvider>
  );
}
