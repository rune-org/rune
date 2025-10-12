'use client'

import Image from "next/image"
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { Mail, BarChart, Code, Cloud, Calendar, Share2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function TemplatesPage() {
  return (
    <main className="min-h-screen bg-neutral-900 text-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold">Templates</h1>
        </div>

        {/* Recently Used */}
        <section className="mb-6">
          <h2 className="text-sm text-slate-400 mb-3">Recently Used</h2>

          <div className="inline-flex items-center gap-3 bg-neutral-800 hover:bg-neutral-700 transition rounded-md px-4 py-3">
            <Image
              src="/icons/social/email.svg"
              alt="email"
              width={20}
              height={20}
            />
            <span className="text-sm">Email → Slack Alert</span>
          </div>
        </section>

        <hr className="border-neutral-700 my-6" />

        {/* Trending Templates */}
        <section className="mb-8">
          <h2 className="text-sm text-slate-400 mb-4">Trending Templates</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* GPT → Sheets */}
            <Card className="bg-neutral-800 hover:bg-neutral-750 transition border border-neutral-700">
              <CardContent className="p-5 flex flex-col">
                <div className="flex items-center gap-5 mb-3">
                  <Image src="/icons/social/gpt.png" alt="GPT" 
                  width={50} height={50} />
                  <span className="text-white text-2xl font-bold">→</span>
                  <Image src="/icons/social/sheets.png" alt="Sheets"
                   width={50} height={50} />
                </div>
                <CardTitle className="text-base font-semibold mb-1">
                  GPT → Sheets
                </CardTitle>
                <CardDescription className="text-sm text-slate-400 mb-4">
                  Talk to your google sheets using ChatGPT 5
                </CardDescription>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-xs text-slate-400">Create from template</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-neutral-700 hover:text-white"
                  >
                    Use
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Postgres → Telegram */}
            <Card className="bg-neutral-800 hover:bg-neutral-750 transition border border-neutral-700">
              <CardContent className="p-5 flex flex-col">
                <div className="flex items-center gap-5 mb-3">
                  <Image src="/icons/social/postgres.png" alt="Postgres"
                   width={70} height={70} />
                  <span className="text-white text-2xl font-bold">→</span>
                  <Image src="/icons/social/telegram.png" alt="Telegram" 
                  width={50} height={50} />
                </div>
                <CardTitle className="text-base font-semibold mb-1">
                  Postgres → Telegram
                </CardTitle>
                <CardDescription className="text-sm text-slate-400 mb-4">
                  Process Multiple Media Files in Telegram with Gemini AI & PSQL DB
                </CardDescription>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-xs text-slate-400">Create from template</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-neutral-700 hover:text-white"
                  >
                    Use
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* GPT → Narrative Stories */}
            <Card className="bg-neutral-800 hover:bg-neutral-750 transition border border-neutral-700">
              <CardContent className="p-5 flex flex-col">
                <div className="flex items-center gap-5 mb-3">
                  <Image src="/icons/social/gpt.png" alt="GPT" 
                  width={50} height={50} />
                  <span className="text-white text-2xl font-bold">→</span>
                  <Image src="/icons/social/file-text.png" alt="Narrative" 
                  width={50} height={50} />
                </div>
                <CardTitle className="text-base font-semibold mb-1">
                  GPT → Narrative Stories
                </CardTitle>
                <CardDescription className="text-sm text-slate-400 mb-4">
                  Transform Travel Photos into Narrative Stories with GPT-4o Vision
                </CardDescription>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-xs text-slate-400">Create from template</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-neutral-700 hover:text-white"
                  >
                    Use
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* RSS → Discord */}
            <Card className="bg-neutral-800 hover:bg-neutral-750 transition border border-neutral-700">
              <CardContent className="p-5 flex flex-col">
                <div className="flex items-center gap-5 mb-3">
                  <Image src="/icons/social/rss.svg" alt="RSS" 
                  width={50} height={50} />
                  <span className="text-white text-2xl font-bold">→</span>
                  <Image src="/icons/social/discord.svg" alt="Discord" 
                  width={50} height={50} />
                </div>
                <CardTitle className="text-base font-semibold mb-1">
                  RSS → Discord
                </CardTitle>
                <CardDescription className="text-sm text-slate-400 mb-4">
                  Post new feed items to channel
                </CardDescription>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-xs text-slate-400">Create from template</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-neutral-700 hover:text-white"
                  >
                    Use
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <hr className="border-neutral-700 my-6" />

        {/* Browse by Category */}
        <section>
          <h2 className="text-sm text-slate-400 mb-4">Browse by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                className="flex items-center gap-2 bg-[#1c1c1c] hover:bg-[#2a2a2a] transition rounded-md p-3"
              >
                <div className="p-1.5 rounded-md bg-[#2d2d2d]">
                  {cat.icon}
                </div>
                <span className="text-sm">{cat.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Create New Template */}
        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            className="bg-neutral-800 hover:bg-neutral-700 transition"
          >
            + Create New Template
          </Button>
        </div>
      </div>
    </main>
  )
}
