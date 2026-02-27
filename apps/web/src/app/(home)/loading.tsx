import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
    return (
        <div className="flex flex-col">
            <div className="flex min-h-screen flex-col items-center justify-center px-4 pt-32 pb-20">
                <Skeleton className="mb-8 size-32 rounded-full sm:size-40" />
                <Skeleton className="mb-4 h-12 w-72 sm:h-16 sm:w-120" />
                <Skeleton className="mb-2 h-12 w-56 sm:h-16 sm:w-100" />
                <Skeleton className="mt-4 h-5 w-64 sm:w-96" />
                <div className="mt-8 flex gap-4">
                    <Skeleton className="h-12 w-40 rounded-xl" />
                    <Skeleton className="h-12 w-44 rounded-xl" />
                </div>
            </div>

            <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-8">
                <div className="mb-8 flex flex-col items-center gap-3">
                    <Skeleton className="h-9 w-64" />
                    <Skeleton className="h-5 w-80" />
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <Skeleton className="h-95 rounded-3xl md:col-span-2" />
                    <Skeleton className="h-95 rounded-3xl" />
                    <Skeleton className="h-95 rounded-3xl" />
                    <Skeleton className="h-95 rounded-3xl md:col-span-2" />
                </div>
            </div>
        </div>
    );
}
