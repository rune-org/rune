import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { AppProviders } from "@/components/providers/ClientProviders";
import { RequireAuth } from "@/components/auth/RequireAuth";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <AppProviders>
      <RequireAuth>
        <AppShell>{children}</AppShell>
      </RequireAuth>
    </AppProviders>
  );
}
