"use client";

import type { ReactNode } from "react";
import { AppStateProvider } from "@/lib/state";
import { AuthProvider } from "@/lib/auth";
import { useEffect } from "react";
import { setupClientInterceptors } from "@/lib/api/setupClientInterceptors";
import { TooltipProvider } from "@/components/ui/tooltip";

export function ClientProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    setupClientInterceptors();
  }, []);

  return (
    <AuthProvider>
      <AppStateProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </AppStateProvider>
    </AuthProvider>
  );
}
