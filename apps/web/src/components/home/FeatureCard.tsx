"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Lock, Shield, Crown, Eye, FileEdit } from "lucide-react";

type VisualType = "sso" | "version" | "roles" | "observability";

interface FeatureCardProps {
  title: string;
  description: string;
  className?: string;
  delay?: number;
  visual: VisualType;
}

export function FeatureCard({ title, description, className, delay = 0, visual }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/12 backdrop-blur-sm transition-all duration-500 hover:border-white/10 hover:bg-zinc-900/40",
        className
      )}
    >
      <div className="relative z-20 p-8 flex flex-col">
        <h3 className="text-xl font-medium text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground leading-relaxed text-sm max-w-[90%]">{description}</p>
      </div>

      <div className="mt-auto w-full h-64 relative overflow-hidden">
         <div className="absolute inset-0 z-10 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
         {renderVisual(visual)}
      </div>
    </motion.div>
  );
}

function renderVisual(type: VisualType) {
  switch (type) {
    case "version":
      return <VersionVisual />;
    case "sso":
      return <SSOVisual />;
    case "roles":
      return <RolesVisual />;
    case "observability":
        return <ObservabilityVisual />;
    default:
      return null;
  }
}

function RolesVisual() {
    return (
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full max-w-[85%] h-full flex items-center justify-center">
                
                <div className="absolute z-30 w-full bg-zinc-900/90 border border-white/10 rounded-xl p-4 shadow-2xl transition-all duration-500 ease-out group-hover:-translate-y-20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-inner">
                                <Crown className="w-4 h-4 text-black" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <div className="h-2 w-24 bg-white/40 rounded-full" />
                                <div className="h-1.5 w-16 bg-white/20 rounded-full" />
                            </div>
                        </div>
                        <div className="px-2.5 py-1 rounded-md bg-white/10 text-[10px] font-medium text-white border border-white/5">
                            Owner
                        </div>
                    </div>
                </div>
                
                <div className="absolute z-20 w-full bg-zinc-900/80 border border-white/10 rounded-xl p-4 shadow-xl backdrop-blur-sm transition-all duration-500 ease-out
                    scale-[0.95] translate-y-4 
                    group-hover:scale-[0.98] group-hover:translate-y-0">
                    <div className="flex items-center justify-between opacity-90">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                                <FileEdit className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <div className="h-2 w-20 bg-white/20 rounded-full" />
                                <div className="h-1.5 w-10 bg-white/10 rounded-full" />
                            </div>
                        </div>
                         <div className="px-2.5 py-1 rounded-md bg-white/5 text-[10px] text-white/50 border border-white/5">
                            Editor
                        </div>
                    </div>
                </div>

                <div className="absolute z-10 w-full bg-zinc-900/60 border border-white/10 rounded-xl p-4 shadow-lg backdrop-blur-sm transition-all duration-500 ease-out
                    scale-[0.90] translate-y-8 
                    group-hover:translate-y-20 group-hover:scale-[0.96]">
                     <div className="flex items-center justify-between opacity-60">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                                <Eye className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <div className="h-2 w-16 bg-white/10 rounded-full" />
                                <div className="h-1.5 w-8 bg-white/5 rounded-full" />
                            </div>
                        </div>
                        <div className="px-2.5 py-1 rounded-md bg-white/5 text-[10px] text-white/30 border border-white/5">
                            Viewer
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}

function VersionVisual() {
  return (
    <div className="absolute inset-x-8 bottom-0 h-full">
        <div className="absolute left-8 top-0 bottom-0 w-px bg-white/10" />
        <div className="flex flex-col gap-6 pt-8 pl-6">
            <div className="flex items-center gap-3 opacity-30">
                <div className="w-4 h-4 rounded-full border border-white/50 bg-gray-400" />
                <div className="h-2 w-24 rounded-full bg-white/10" />
            </div>
            <div className="flex items-center gap-3 opacity-60">
                <div className="w-4 h-4 rounded-full border border-white/80 bg-white" />
                <div className="h-2 w-32 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center gap-3">
                <div className="relative w-6 h-6 flex items-center justify-center">
                   <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" />
                   <div className="w-4.5 h-4.5 bg-white rounded-full relative z-10" />
                </div>
                <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[19px] font-mono text-white/90">
                   v2.4.0 • main
                </div>
            </div>
        </div>
    </div>
  );
}

function SSOVisual() {
  return (
    <div className="flex items-center justify-center h-full w-full pb-4">
       <div className="relative group-hover:scale-105 transition-transform duration-500">
          <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full scale-150" />
          <div className="relative h-34 w-34 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl">
              <Shield className="w-25 h-25 text-white/80" strokeWidth={1.5} />
          </div>
          <div className="absolute -right-4 -top-2 bg-white text-black p-1.5 rounded-lg shadow-lg">
              <Lock className="w-7 h-7" />
          </div>
       </div>
    </div>
  );
}

function ObservabilityVisual() {
    return (
        <div className="absolute bottom-0 inset-x-8 h-32 flex items-end justify-between gap-1 opacity-80">
             {[40, 70, 35, 85, 60, 50, 75, 45, 80, 100, 65, 40, 70, 35].map((h, i) => (
                <motion.div 
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    transition={{ delay: i * 0.03, duration: 0.5 }}
                    className={cn(
                        "w-full rounded-t-sm transition-all duration-300",
                        i % 3 === 0 ? "bg-white/30" : "bg-white/5 hover:bg-white/20"
                    )}
                />
            ))}
        </div>
    )
}