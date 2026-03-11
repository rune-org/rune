"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

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

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    // Error boundaries in Next.js - error is already displayed to user
    return (
        <div className="relative flex min-h-[60vh] w-full animate-fade-in flex-col items-center justify-center overflow-hidden p-4">
            <AmbientBackground />

            <Empty className="relative z-10 max-w-4xl">
                <EmptyMedia variant="default" className="-mb-12">
                    <Image
                        src="/images/rune-stone-fractured.svg"
                        alt="Rune Stone"
                        width={240}
                        height={240}
                        className="size-60 animate-fade-in-delayed invert drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]"
                    />
                </EmptyMedia>
                <EmptyHeader className="gap-8">
                    <EmptyTitle className="whitespace-nowrap font-display text-4xl tracking-tight text-foreground sm:text-6xl">
                        The Rune Has <em>Shattered</em>
                    </EmptyTitle>
                    <div className="flex flex-col gap-1 text-center">
                        <EmptyDescription className="whitespace-nowrap text-lg font-medium text-muted-foreground sm:text-xl">
                            An unexpected rift tore through the spell.
                        </EmptyDescription>
                    </div>
                </EmptyHeader>
                <EmptyContent className="mt-4">
                    <div className="flex items-center gap-4">
                        <Button
                            onClick={reset}
                            variant="outline"
                            size="lg"
                            className="h-14 min-w-45 border-blue-500/30 bg-slate-950/30 text-base font-bold uppercase tracking-[0.2em] text-blue-100 shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)] backdrop-blur-md transition-all duration-500 hover:border-blue-400/50 hover:bg-blue-900/20 hover:text-white hover:shadow-[0_0_50px_-10px_rgba(59,130,246,0.5)]"
                        >
                            Try Again
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            size="lg"
                            className="h-14 min-w-45 border-blue-500/30 bg-slate-950/30 text-base font-bold uppercase tracking-[0.2em] text-blue-100 shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)] backdrop-blur-md transition-all duration-500 hover:border-blue-400/50 hover:bg-blue-900/20 hover:text-white hover:shadow-[0_0_50px_-10px_rgba(59,130,246,0.5)]"
                        >
                            <Link href="/create">Return to Rune</Link>
                        </Button>
                    </div>
                </EmptyContent>
            </Empty>
        </div>
    );
}
