"use client";

import { Container } from "@/components/shared/Container";
import { FeatureCard } from "./FeatureCard";
import { motion } from "framer-motion";

export function FeatureSection() {
  return (
    <section id="features" className="py-18 relative overflow-hidden">
      <Container>
        <div className="mb-14 md:text-center max-w-3xl mx-auto space-y-6">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-4xl md:text-5xl font-bold font-serif tracking-tight text-foreground"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Empower your workflows
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto"
          >
            Scalable automation designed for modern engineering teams.
            Strictly typed, version controlled, and secure by default.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[380px]">
          
          <FeatureCard
            title="Version Control"
            description="Treat your automation like code. Branch, diff, and rollback with zero config."
            className="md:col-span-2"
            delay={0.2}
            visual="version"
          />

          <FeatureCard
            title="Enterprise SSO"
            description="SAML ready. Manage access for your organization seamlessly."
            delay={0.3}
            visual="sso"
          />

          <FeatureCard
            title="Live Tracing"
            description="Watch execution in real-time with full payload inspection at every node."
            delay={0.4}
            visual="observability"
          />
          
           <FeatureCard
            title="Role-Based Access"
            description="Granular permissions for your entire team. Separate builders from viewers."
            className="md:col-span-2"
            delay={0.5}
            visual="roles"
          />

        </div>
      </Container>
    </section>
  );
}