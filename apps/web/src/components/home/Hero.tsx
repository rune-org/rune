"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, PlayCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Playfair_Display } from "next/font/google";
import { cn } from "@/lib/cn";

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-playfair",
});

const runeLogo = "/icons/Logo.svg"; 

export function Hero() {
  return (
    <section className={cn("relative w-full min-h-screen flex flex-col justify-center items-center overflow-hidden pt-32 pb-20", playfair.variable)}>
      
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      </div>

      <div className="container relative z-10 flex flex-col items-center text-center space-y-10 mx-auto px-4">
        
        <motion.div
          initial={{ opacity: 0, scale: 1.4, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 2.3, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mb-20"
        >
           <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full scale-150 pointer-events-none" />
           
           <div className="relative w-32 h-32 md:w-40 md:h-40 drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]">
             <Image 
               src={runeLogo} 
               alt="Rune Logo" 
               fill 
               className="object-contain dark:invert" 
               priority
             />
           </div>
        </motion.div>

        <div className="space-y-6 max-w-5xl">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-6xl md:text-7xl font-serif tracking-tight text-foreground leading-[1.0] md:leading-[0.95]"
            style={{ fontFamily: 'var(--font-playfair)' }}
          >
            Describe your Workflow. <br />
            <span className="italic font-light text-muted-foreground">Automate your World.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-2xl mx-auto text-lg text-muted-foreground/80 sm:text-xl leading-relaxed font-sans"
          >
            The infinite canvas for everyone. Orchestrate data, APIs, and agents with a simple drag and drop!
          </motion.p>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center pt-4"
        >
          <Button 
            asChild 
            size="lg" 
            className="h-14 px-8 text-base rounded-full bg-white !text-black hover:bg-gray-200 border-0 shadow-[0_0_30px_-10px_rgba(255,255,255,0.3)] transition-all"
          >
            <Link href="/create">
              Start Building <ArrowRight className="ml-2 h-4 w-4 !text-black" />
            </Link>
          </Button>
          
          <Button 
            variant="outline" 
            asChild 
            size="lg" 
            className="h-14 px-8 text-base rounded-full border-muted-foreground/20 hover:bg-muted/10 hover:text-foreground transition-all"
          >
            <Link href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">
              <PlayCircle className="mr-2 h-4 w-4" /> See how it works
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}