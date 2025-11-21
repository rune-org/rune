"use client";

import { Container } from "@/components/shared/Container";
import { motion } from "framer-motion";
import { ReactFlowProvider } from "@xyflow/react";
import { MarketingCanvas } from "./MarketingCanvas";

const steps = [
  {
    id: "01",
    title: "Connect your tools",
    description: "Drag triggers and actions from the library. Supports Webhooks, HTTP, Postgres, Slack, and more.",
  },
  {
    id: "02",
    title: "Add logic & AI",
    description: "Use 'If' nodes to route data, or drop in an 'Agent' node to make decisions using LLMs.",
  },
  {
    id: "03",
    title: "Deploy to Edge",
    description: "One click deploy. We compile your graph to a high-performance worker running on the edge.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-18 relative overflow-hidden bg-gradient-to-b from-zinc-950/30 to-transparent backdrop-blur-lg" style={{ 
    maskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)',
    WebkitMaskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)'
    }}>
      <Container className="flex flex-col gap-16 md:gap-24">
        
        <div className="space-y-16">
            <div className="text-center max-w-3xl mx-auto space-y-4">
               <h2 
                 className="text-3xl font-bold md:text-5xl font-serif tracking-tight"
                 style={{ fontFamily: 'var(--font-playfair)' }}
               >
                 Visual clarity, <br />
                 <span className="text-muted-foreground italic font-normal text-4xl">Uncompromised power.</span>
               </h2>
               <p className="text-muted-foreground text-lg leading-relaxed">
                 Stop wrestling with cron jobs. Rune is the modern standard for orchestration.
               </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 relative">
              <div className="hidden md:block absolute top-6 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-border/40 to-transparent border-t border-dashed border-muted-foreground/30 z-0" />

              {steps.map((step, index) => (
                <motion.div 
                  key={step.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                  className="relative z-10 flex flex-col items-center text-center group"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-sm font-medium text-foreground shadow-xl transition-all group-hover:border-white/30 group-hover:scale-110">
                    {step.id}
                  </div>
                  <h3 className="text-xl font-medium mb-3 text-foreground group-hover:text-white transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>
        </div>

        <motion.div 
           initial={{ opacity: 0, scale: 0.95, y: 40 }}
           whileInView={{ opacity: 1, scale: 1, y: 0 }}
           viewport={{ once: true }}
           transition={{ duration: 0.8, ease: "circOut", delay: 0.4 }}
           className="relative w-full h-[600px] lg:h-[700px] -mx-4 md:mx-0"
        >
           <ReactFlowProvider>
              <MarketingCanvas />
           </ReactFlowProvider>
           
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />
        </motion.div>

      </Container>
    </section>
  );
}