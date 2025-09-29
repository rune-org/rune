import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const iconMap = {
  sso: "/icons/sso.svg",
  version: "/icons/version.svg",
  role: "/icons/role.svg",
} as const;

type FeatureIconName = keyof typeof iconMap;

interface FeatureCardProps {
  title: string;
  description: string;
  icon: FeatureIconName;
}

function FeatureIcon({ name }: { name: FeatureIconName }) {
  const icon = iconMap[name];

  return (
    <span
      aria-hidden
      className="block h-72 w-72 bg-primary"
      style={{
        mask: `url(${icon}) no-repeat center / contain`,
        WebkitMask: `url(${icon}) no-repeat center / contain`,
      }}
    />
  );
}

export function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <Card className="border border-border/60 bg-primary/10">
      <CardHeader className="flex items-start gap-4">
        <div className="flex h-40 w-40 items-center justify-center max-w-lg mx-auto px-4">
          <FeatureIcon name={icon} />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}
