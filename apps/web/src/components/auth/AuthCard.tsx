import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <Card className="w-full max-w-md border-border/70 bg-card/80 shadow-[0_32px_64px_hsl(220_55%_6%/0.35)]">
      <CardHeader className="space-y-3 text-center">
        <CardTitle className="text-3xl font-semibold text-foreground">
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-sm text-muted-foreground">
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
      {footer ? (
        <div className="border-t border-border/60 p-6 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}
