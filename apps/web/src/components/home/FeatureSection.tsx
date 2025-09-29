import { Section } from "@/components/shared/Section";

import { FeatureCard } from "./FeatureCard";

type FeatureIconName = "sso" | "version" | "role";

type Feature = {
  title: string;
  description: string;
  icon: FeatureIconName;
};

const features: Feature[] = [
  {
    title: "Single Sign-On",
    description: "Bring your identity provider and manage access from day one.",
    icon: "sso",
  },
  {
    title: "Version Control",
    description: "Track every change with built-in rollback and approvals.",
    icon: "version",
  },
  {
    title: "Role-Based Workspaces",
    description: "Grant creators, reviewers, and operators the right tools.",
    icon: "role",
  },
];

export function FeatureSection() {
  return (
    <Section id="features" className="gap-8">
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight">
          Empower your workflows
        </h2>
        <p className="text-muted-foreground">
          Scalable automation for startups and enterprises alike, with
          guardrails designed for collaboration.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </Section>
  );
}
