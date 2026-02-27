"use client";

import { Container } from "@/components/shared/Container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ArrowRight,
  Info
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const creationOptions = [
  {
    id: "scratch",
    title: "Start from Scratch",
    description: "Build a custom workflow from the ground up",
    icon: "/icons/StartFromScratchIcon.svg",
    action: "Create New",
    href: "/create/app"
  },
  {
    id: "template",
    title: "Use a Template",
    description: "Choose from pre-built workflow templates",
    icon: "/icons/UseTemplateIcon.svg",
    action: "Browse Templates",
    href: "/create/templates"
  },
  {
    id: "agent",
    title: "Ask an Agent",
    description: "Let AI help you build your workflow",
    icon: "/icons/AskAgentIcon.svg",
    action: "Start with Smith",
    href: "/create/smith"
  }
];

const popularWorkflows = [
  {
    title: "Email → Slack Alert",
    description: "Send alerts to Slack channels based on email content.",
    fromIcon: "/icons/social/email.svg",
    toIcon: "/icons/social/stack-alert.svg",
    fromColor: "text-red-400",
    toColor: "text-purple-400"
  },
  {
    title: "Weather → Morning Email",
    description: "Get today's weather forecast in your inbox at 8 AM.",
    fromIcon: "/icons/social/weather.svg",
    toIcon: "/icons/social/email.svg",
    fromColor: "text-yellow-400",
    toColor: "text-red-400"
  },
  {
    title: "Calendar → Planner",
    description: "Plan your events, the easy way.",
    fromIcon: "/icons/social/calendar.svg",
    toIcon: "/icons/social/planner.svg",
    fromColor: "text-blue-400",
    toColor: "text-green-400"
  },
  {
    title: "RSS → Discord",
    description: "Post new blog articles into a channel.",
    fromIcon: "/icons/social/rss.svg",
    toIcon: "/icons/social/discord_purple.svg",
    fromColor: "text-orange-400",
    toColor: "text-indigo-400"
  }
];

export default function CreatePage() {
  const router = useRouter();

  return (
    <Container className="flex flex-col gap-12 py-12" widthClassName="max-w-6xl">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Build your next workflow.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Pick a starting point, you&apos;ll be running in minutes.
        </p>
      </div>

      {/* Creation Options */}
      <div className="grid gap-6 md:grid-cols-3">
        {creationOptions.map((option) => {
          return (
            <Card 
              key={option.id} 
              className="group relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-200 hover:shadow-lg cursor-pointer"
              onClick={() => router.push(option.href)}
            >
              <CardHeader className="text-center pb-6">
                <div className="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Image 
                    src={option.icon} 
                    alt={option.title}
                    width={80}
                    height={80}
                  />
                </div>
                <CardTitle className="text-xl">{option.title}</CardTitle>
                <CardDescription className="text-sm whitespace-nowrap">
                  {option.description}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Popular Workflows */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Popular Workflows</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {popularWorkflows.map((workflow, index) => {
            return (
              <Card key={index} className="group hover:shadow-lg transition-all duration-200 cursor-pointer border hover:border-border/80">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                      <Image 
                        src={workflow.fromIcon} 
                        alt={`${workflow.title.split(' → ')[0]} icon`}
                        width={32}
                        height={32}
                      />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                      <Image 
                        src={workflow.toIcon} 
                        alt={`${workflow.title.split(' → ')[1]} icon`}
                        width={32}
                        height={32}
                      />
                    </div>
                  </div>
                  <CardTitle className="text-lg">{workflow.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {workflow.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-muted/40 bg-muted/20">
        <CardContent className="flex items-center gap-3 p-6">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Don&apos;t worry, you can customize all template workflows to your services.
          </p>
        </CardContent>
      </Card>
    </Container>
  );
}
