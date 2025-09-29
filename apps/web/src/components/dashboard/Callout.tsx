import { Info } from "lucide-react";

import { Card } from "@/components/ui/card";

export function Callout() {
  return (
    <Card className="flex flex-col gap-3 border-dashed border-border/80 bg-muted/20 p-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3 text-foreground">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Info className="h-5 w-5" />
        </span>
        <div>
          <p className="font-medium text-foreground">
            Customize every template
          </p>
          <p className="text-muted-foreground">
            Don&apos;t worry, you can map services, rename steps, and add logic
            before you ship.
          </p>
        </div>
      </div>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        Secure • Observable • Reliable
      </span>
    </Card>
  );
}
