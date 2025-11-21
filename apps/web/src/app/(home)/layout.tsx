import type { ReactNode } from "react";

import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";

interface HomeLayoutProps {
  children: ReactNode;
}

export default function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}