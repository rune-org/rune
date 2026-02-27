import { Skeleton } from "@/components/ui/skeleton";

export default function CanvasLoading() {
    return (
        <div className="flex h-screen flex-col bg-background">
            <div className="flex items-center gap-2 p-2">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="mx-1 h-6 w-px bg-border" />
                <Skeleton className="h-9 w-20 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="mx-1 h-6 w-px bg-border" />
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div className="flex w-75 flex-col gap-3 border-r border-border p-4">
                    <Skeleton className="h-8 w-full rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                        <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                </div>

                <div className="relative flex-1">
                    <div className="absolute inset-0 bg-[radial-gradient(circle,hsl(var(--muted))_1px,transparent_1px)] bg-size-[24px_24px] opacity-30" />

                    <div className="absolute bottom-4 left-4">
                        <Skeleton className="h-29.25 w-50 rounded-lg opacity-60" />
                    </div>
                </div>

                <div className="flex w-[320px] flex-col gap-4 border-l border-border p-4">
                    <Skeleton className="h-6 w-32" />
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-9 w-full rounded-lg" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-9 w-full rounded-lg" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-20 w-full rounded-lg" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
