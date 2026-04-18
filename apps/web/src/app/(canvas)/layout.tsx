import type { ReactNode } from "react";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppProviders } from "@/components/providers/ClientProviders";

export default function CanvasLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <RequireAuth>{children}</RequireAuth>
    </AppProviders>
  );
}
