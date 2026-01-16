"use client";

import { useState, FormEvent } from "react";
import { Wand2, Send } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

import { Container } from "@/components/shared/Container";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// Floating Orb Component
function FloatingOrb({ delay, duration, size, color, position }: { 
  delay: number; 
  duration: number; 
  size: string; 
  color: string; 
  position: { x: string; y: string } 
}) {
  return (
    <motion.div
      className={cn("absolute rounded-full blur-3xl opacity-30", size, color)}
      style={{ left: position.x, top: position.y }}
      animate={{
        y: [0, -30, 0],
        x: [0, 15, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

export default function SmithQuickstartPage() {
  const [prompt, setPrompt] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!prompt.trim()) return;

    localStorage.setItem("smith_pending_prompt", prompt.trim());
    window.location.href = "/create/app?smith=pending";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background selection:bg-primary/20">
      {/* Animated Background */}
      <div className="pointer-events-none absolute inset-0">
        <FloatingOrb delay={0} duration={8} size="h-[500px] w-[500px]" color="bg-violet-600" position={{ x: "-10%", y: "-10%" }} />
        <FloatingOrb delay={2} duration={10} size="h-[400px] w-[400px]" color="bg-blue-600" position={{ x: "70%", y: "10%" }} />
        <FloatingOrb delay={4} duration={12} size="h-[600px] w-[600px]" color="bg-indigo-600" position={{ x: "50%", y: "60%" }} />
        <FloatingOrb delay={1} duration={9} size="h-[300px] w-[300px]" color="bg-pink-600" position={{ x: "20%", y: "70%" }} />
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
        
        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,var(--background)_70%)]" />
      </div>

      <Container className="relative z-10 flex min-h-screen flex-col items-center justify-center py-12" widthClassName="max-w-5xl">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 flex flex-col items-center text-center"
        >
          <motion.div 
            className="relative mb-8"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <div className="absolute inset-0 animate-pulse rounded-full bg-primary/30 blur-2xl" />
            <Image
              src="/icons/smith_logo_white.svg"
              alt="Smith"
              width={180}
              height={45}
              className="relative h-12 w-auto drop-shadow-[0_0_30px_rgba(99,102,241,0.5)]"
              priority
            />
          </motion.div>
          
          <h1 className="mb-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="italic text-foreground/90" style={{ fontFamily: 'var(--font-display), Playfair Display, serif' }}>Describe</span>
            <span className="text-foreground/70"> it, </span>
            <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
              Smith builds it.
            </span>
          </h1>
          
          <p className="max-w-xl text-base text-muted-foreground/80 md:text-lg">
            Transform your ideas into production-ready workflows with a single prompt.
          </p>
        </motion.div>

        {/* Main Input Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative w-full max-w-3xl"
        >
          <Card className={cn(
            "relative overflow-hidden border-2 transition-all duration-500",
            isFocused 
              ? "border-primary/50 bg-background/80 shadow-[0_0_60px_-15px] shadow-primary/30" 
              : "border-border/30 bg-background/40 hover:border-border/50"
          )}>
            {/* Animated border glow */}
            <div className={cn(
              "absolute inset-0 transition-opacity duration-500",
              isFocused ? "opacity-100" : "opacity-0"
            )}>
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            </div>

            <div className="relative p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <Wand2 className="h-5 w-5 text-primary/70" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-foreground">What would you like to build?</h2>
                </div>
              </div>

              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your workflow in plain English..."
                className="min-h-[140px] resize-none border-0 bg-transparent p-0 text-base leading-relaxed placeholder:text-muted-foreground/40 focus-visible:ring-0"
              />

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                </div>
                
                <Button
                  onClick={() => handleSubmit()}
                  disabled={!prompt.trim()}
                  className={cn(
                    "group gap-2 px-6 transition-all duration-300",
                    prompt.trim() && "shadow-lg shadow-primary/25"
                  )}
                >
                  <span className="flex items-center gap-2">
                    Generate
                    <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </Container>
    </div>
  );
}