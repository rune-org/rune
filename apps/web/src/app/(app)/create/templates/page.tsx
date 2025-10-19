import Image from "next/image";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Mail,
  BarChart,
  Code,
  Cloud,
  Calendar,
  Share2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/layout/PageHeader";

export default function TemplatesPage() {
  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader title="Templates" />

      {/* Recently Used */}
      <section className="space-y-3">
        <h2 className="text-sm text-muted-foreground">Recently Used</h2>

        <div className="inline-flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
          <Image src="/icons/social/email.svg" alt="email" width={20} height={20} />
          <span className="text-sm">Email → Slack Alert</span>
        </div>
      </section>

      <hr className="border-border/60" />

      {/* Trending Templates */}
      <section className="space-y-4">
        <h2 className="text-sm text-muted-foreground">Trending Templates</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* GPT → Sheets */}
          <Card className="transition-colors hover:border-accent/50 hover:bg-accent/10">
            <CardContent className="flex flex-col p-5">
              <div className="mb-3 flex items-center gap-5">
                <Image src="/icons/social/gpt.svg" alt="GPT" width={50} height={50} />
                <span className="text-2xl font-bold">→</span>
                <Image src="/icons/social/sheets.svg" alt="Sheets" width={50} height={50} />
              </div>
              <CardTitle className="mb-1 text-base font-semibold">GPT → Sheets</CardTitle>
              <CardDescription className="mb-4 text-sm">
                Talk to your Google Sheets using ChatGPT 5
              </CardDescription>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Create from template</span>
                <Button variant="outline" size="sm">
                  Use
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Postgres → Telegram */}
          <Card className="transition-colors hover:border-accent/50 hover:bg-accent/10">
            <CardContent className="flex flex-col p-5">
              <div className="mb-3 flex items-center gap-5">
                <Image src="/icons/social/postgres.svg" alt="Postgres" width={70} height={70} />
                <span className="text-2xl font-bold">→</span>
                <Image src="/icons/social/telegram.svg" alt="Telegram" width={50} height={50} />
              </div>
              <CardTitle className="mb-1 text-base font-semibold">Postgres → Telegram</CardTitle>
              <CardDescription className="mb-4 text-sm">
                Process multiple media files in Telegram with Gemini AI & PSQL DB
              </CardDescription>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Create from template</span>
                <Button variant="outline" size="sm">
                  Use
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* GPT → Narrative Stories */}
          <Card className="transition-colors hover:border-accent/50 hover:bg-accent/10">
            <CardContent className="flex flex-col p-5">
              <div className="mb-3 flex items-center gap-5">
                <Image src="/icons/social/gpt.svg" alt="GPT" width={50} height={50} />
                <span className="text-2xl font-bold">→</span>
                <Image src="/icons/social/file-text.svg" alt="Narrative" width={50} height={50} />
              </div>
              <CardTitle className="mb-1 text-base font-semibold">GPT → Narrative Stories</CardTitle>
              <CardDescription className="mb-4 text-sm">
                Transform travel photos into narrative stories with GPT-4o Vision
              </CardDescription>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Create from template</span>
                <Button variant="outline" size="sm">
                  Use
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* RSS → Discord */}
          <Card className="transition-colors hover:border-accent/50 hover:bg-accent/10">
            <CardContent className="flex flex-col p-5">
              <div className="mb-3 flex items-center gap-5">
                <Image src="/icons/social/rss.svg" alt="RSS" width={50} height={50} />
                <span className="text-2xl font-bold">→</span>
                <Image src="/icons/social/discord_purple.svg" alt="Discord" width={50} height={50} />
              </div>
              <CardTitle className="mb-1 text-base font-semibold">RSS → Discord</CardTitle>
              <CardDescription className="mb-4 text-sm">
                Post new feed items to channel
              </CardDescription>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Create from template</span>
                <Button variant="outline" size="sm">
                  Use
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <hr className="border-border/60" />

      {/* Browse by Category */}
      <section className="space-y-4">
        <h2 className="text-sm text-muted-foreground">Browse by Category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { name: "Email", icon: <Mail size={16} /> },
            { name: "Analytics", icon: <BarChart size={16} /> },
            { name: "Development", icon: <Code size={16} /> },
            { name: "Cloud", icon: <Cloud size={16} /> },
            { name: "Scheduling", icon: <Calendar size={16} /> },
            { name: "Social Media", icon: <Share2 size={16} /> },
            { name: "All Templates", icon: <FileText size={16} /> },
          ].map((cat, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-accent/10"
            >
              <div className="rounded-md bg-background/70 p-1.5">{cat.icon}</div>
              <span className="text-sm">{cat.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Create New Template */}
      <div className="mt-2 flex justify-center">
        <Button size="lg">+ Create New Template</Button>
      </div>
    </Container>
  );
}
