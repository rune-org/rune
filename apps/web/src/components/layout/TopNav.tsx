"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/Container";
import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/cn";
import { siteConfig } from "@/lib/site";

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <Container
        className="flex h-16 items-center gap-6"
        widthClassName="max-w-6xl"
      >
        <Logo
          priority
          className="h-7"
          wrapperClassName="flex h-10 items-center"
        />
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {siteConfig.mainNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.title}
                href={item.href}
                className={cn(
                  "inline-flex h-10 items-center rounded-[calc(var(--radius)-0.5rem)] px-3 text-m font-medium transition-colors relative top-[5px]",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <Link
            href="/sign-in"
            className="hidden h-10 items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex relative top-[2px]"
          >
            Sign in
          </Link>
          <Button asChild size="sm" className="relative top-[2px]">
            <Link href="/sign-up">Start building</Link>
          </Button>
        </div>
      </Container>
    </header>
  );
}
