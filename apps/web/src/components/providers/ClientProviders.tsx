"use client";

import type { ReactNode } from "react";
import { AppStateProvider } from "@/lib/state";

export function ClientProviders({ children }: { children: ReactNode }) {
  return <AppStateProvider>{children}</AppStateProvider>;
}
