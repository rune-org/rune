import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

import { AmbientBackground } from "@/components/illustrations/AmbientBackground";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const metadata: Metadata = {
  title: "404 Not Found",
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen w-full animate-fade-in flex-col items-center justify-center overflow-hidden p-4">
      <AmbientBackground />

      <Empty className="relative z-10 max-w-4xl">
        <EmptyMedia variant="default" className="-mb-12">
          <Image
            src="/images/rune-stone.svg"
            alt="Rune Stone"
            width={320}
            height={320}
            className="size-80 animate-fade-in-delayed dark:invert dark:drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]"
          />
        </EmptyMedia>
        <EmptyHeader className="gap-8">
          <EmptyTitle className="whitespace-nowrap font-display text-4xl tracking-tight text-foreground sm:text-6xl">
            The Rune is Silent
          </EmptyTitle>
          <div className="flex flex-col gap-1 text-center">
            <EmptyDescription className="whitespace-nowrap text-lg font-medium text-muted-foreground sm:text-xl">
              The page you seek has faded from the archives.
            </EmptyDescription>
            <EmptyDescription className="text-base text-muted-foreground/70 sm:text-lg">
              You may have wandered off the known path.
            </EmptyDescription>
          </div>
        </EmptyHeader>
        <EmptyContent className="mt-4">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-14 min-w-[260px] border-primary/30 bg-muted/50 text-base font-bold uppercase tracking-[0.2em] text-primary backdrop-blur-md transition-all duration-500 hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
          >
            <Link href="/">Return to Rune</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
