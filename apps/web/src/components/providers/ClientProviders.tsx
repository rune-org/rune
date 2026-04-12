"use client";

import type { ReactNode } from "react";
import { AppStateProvider } from "@/lib/state";
import { AuthProvider } from "@/lib/auth";
import { useEffect } from "react";
import { setupClientInterceptors } from "@/lib/api/setupClientInterceptors";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export function ClientProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    setupClientInterceptors();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppStateProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AppStateProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
