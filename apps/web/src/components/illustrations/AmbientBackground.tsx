import { cn } from "@/lib/cn";

export function AmbientBackground({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 dark:bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.1)_0%,transparent_50%)] animate-pulse will-change-[opacity]" />
      <div className="absolute h-[160vmax] w-[160vmax] animate-[spin_120s_linear_infinite] rounded-full border border-border/20 will-change-transform" />
      <div className="absolute h-[130vmax] w-[130vmax] animate-[spin_90s_linear_infinite_reverse] rounded-full border border-dashed border-border/15 will-change-transform" />
      <div className="absolute h-[80vmax] w-[80vmax] animate-[spin_60s_linear_infinite] rounded-full border border-dotted border-border/20 will-change-transform" />
    </div>
  );
}
