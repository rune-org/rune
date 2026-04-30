import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import type { TemplateSummary, UserResponse } from "@/client/types.gen";

interface TemplateCardProps {
  template: TemplateSummary;
  user: UserResponse | null;
  onUse: (id: number) => void;
  onDelete: (template: TemplateSummary) => void;
}

export function TemplateCard({ template, user, onUse, onDelete }: TemplateCardProps) {
  const canDelete =
    user && (user.id === template.created_by || (user.role === "admin" && template.is_public));

  return (
    <Card className="transition-colors hover:border-accent/50 hover:bg-accent/10">
      <CardContent className="flex flex-col p-5">
        <CardTitle className="mb-1 text-base font-semibold">{template.name}</CardTitle>
        <CardDescription className="mb-4 text-sm">{template.description}</CardDescription>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Create from template</span>
          <div className="flex items-center gap-2">
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(template)}
              >
                Delete
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => onUse(template.id)}>
              Use
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
