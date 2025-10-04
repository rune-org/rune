import { Section } from "@/components/shared/Section";

export function AboutSection() {
  return (
    <Section id="about" className="gap-10 pb-12">
      <div>
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight">About Rune</h2>
          <p className="text-muted-foreground">
            Our mission is to make automation simple, accessible, and powerful
            for everyone. Rune empowers product teams, operations, and
            developers to launch reliable workflows without piecing together
            brittle scripts.
          </p>
          <p className="text-muted-foreground">
            We build with empathy for teams juggling rapid iteration and
            enterprise scale, pairing an intuitive canvas with battle-tested
            infrastructure.
          </p>
        </div>
      </div>
    </Section>
  );
}
