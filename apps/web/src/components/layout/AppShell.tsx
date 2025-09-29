import type { ReactNode } from "react";

import { Footer } from "@/components/layout/Footer";
import { AppSidebar } from "@/components/layout/AppSidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar />
      <div className="flex flex-1 flex-col">
        <main className="flex-1 overflow-x-hidden bg-background/80">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
