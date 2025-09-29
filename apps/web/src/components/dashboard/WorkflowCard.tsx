import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface WorkflowCardProps {
  from: string;
  to: string;
  title: string;
  description: string;
}

export function WorkflowCard({
  from,
  to,
  title,
  description,
}: WorkflowCardProps) {
  return (
    <Card className="flex flex-col gap-4 border-border/60 bg-card/70 p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge
          variant="outline"
          className="border-border/60 text-xs uppercase tracking-wide"
        >
          Template
        </Badge>
        <span className="flex items-center gap-2 text-foreground">
          <span>{from}</span>
          <ArrowRight className="h-4 w-4" />
          <span>{to}</span>
        </span>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
}
