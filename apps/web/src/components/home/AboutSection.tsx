"use client";

import { Container } from "@/components/shared/Container";
import { motion } from "framer-motion";

export function AboutSection() {
  return (
    <section id="about" className="py-24 relative overflow-hidden bg-background">
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <div className="absolute w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full opacity-50 mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
          
          <div className="absolute w-32 h-32 bg-white/10 blur-[40px] rounded-full mix-blend-overlay" />
          
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_60%)]" />
      </div>

      <Container className="relative z-10">
        <div className="max-w-5xl mx-auto space-y-16">
            
            <div className="flex justify-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-s font-medium text-white/80 uppercase tracking-widest backdrop-blur-md shadow-xl"
                >
                    Our Mission
                </motion.div>
            </div>

            <motion.h2
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl md:text-6xl lg:text-7xl font-serif font-medium tracking-tight leading-[1.1] text-center text-foreground drop-shadow-sm"
                style={{ fontFamily: 'var(--font-playfair)' }}
            >
                Make automation simple, accessible, and powerful <span className="text-muted-foreground/60 font-semibold italic"><br />for everyone.</span>
            </motion.h2>

            <div className="grid md:grid-cols-2 gap-12 md:gap-24 text-left md:px-8 pt-12 border-t border-white/5">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                >
                    <h3 className="text-lg font-semibold text-white mb-4">Empowering Builders</h3>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Rune empowers product teams, operations, and developers to launch reliable workflows without piecing together brittle scripts. We believe the tools you use should feel like superpowers, not chores.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                >
                    <h3 className="text-lg font-semibold text-white mb-4">Built with Empathy</h3>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        We build for teams juggling rapid iteration and enterprise scale, pairing an intuitive canvas with battle-tested infrastructure. It&apos;s automation designed for the way you actually work.
                    </p>
                </motion.div>
            </div>
            
        </div>
      </Container>
    </section>
  );
}