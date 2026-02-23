import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
    return (
        <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-5 w-80" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>

            <div className="mt-8 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    );
}
