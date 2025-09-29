import type { ReactNode } from "react";

import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { Container } from "@/components/shared/Container";

interface HomeLayoutProps {
  children: ReactNode;
}

export default function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1">
        <Container asChild>
          <div className="flex flex-col gap-24 py-16">{children}</div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
