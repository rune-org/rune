"use client";

/**
 * /admin — Settings page, admin only.
 *
 * Layout: two-column sidebar-nav + content (Vercel / Linear / GitHub style).
 * Adding a new section = one entry in SETTINGS_NAV + one case in renderContent().
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Shield,
  Bell,
  Info,
  ChevronRight,
} from "lucide-react";

import { Container } from "@/components/shared/Container";
import { SAMLConfigTab } from "@/components/admin/SAMLConfigTab";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Navigation definition — extend this array to add more settings sections
// ---------------------------------------------------------------------------

type SectionId = "general" | "sso" | "notifications" | "about";

interface SettingsSection {
  id: SectionId;
  label: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}

const SETTINGS_NAV: SettingsSection[] = [
  {
    id: "general",
    label: "General",
    description: "Workspace name and branding",
    icon: Settings,
  },
  {
    id: "sso",
    label: "SSO & SAML",
    description: "Enterprise single sign-on",
    icon: Shield,
    badge: "Active",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alerts and thresholds",
    icon: Bell,
  },
  {
    id: "about",
    label: "About",
    description: "Version info and support",
    icon: Info,
  },
];

// ---------------------------------------------------------------------------
// Placeholder for sections not yet built
// ---------------------------------------------------------------------------

function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <div>
        <p className="text-base font-semibold">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content router
// ---------------------------------------------------------------------------

function renderContent(section: SectionId) {
  switch (section) {
    case "general":
      return (
        <ComingSoon
          icon={Settings}
          title="General Settings"
          description="Workspace name, branding, and global configuration options will appear here."
        />
      );
    case "sso":
      return <SAMLConfigTab />;
    case "notifications":
      return (
        <ComingSoon
          icon={Bell}
          title="Notifications & Alerts"
          description="System notification preferences and alert thresholds will be configurable here."
        />
      );
    case "about":
      return (
        <ComingSoon
          icon={Info}
          title="About & Support"
          description="System version, release notes, and support links will appear here."
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminSettingsPage() {
  const router = useRouter();
  const { state } = useAuth();
  const currentUser = state.user;

  const [activeSection, setActiveSection] = useState<SectionId>("sso");

  // Guard: redirect non-admins
  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      router.replace("/create");
    }
  }, [currentUser, router]);

  if (!currentUser) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (currentUser.role !== "admin") return null;

  const active = SETTINGS_NAV.find((s) => s.id === activeSection)!;

  return (
    <Container className="py-10" widthClassName="max-w-6xl">
      {/* ── Page title ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage workspace configuration and system integrations.
        </p>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────── */}
      <div className="flex gap-8 items-start">

        {/* Left: vertical nav */}
        <nav className="hidden w-52 shrink-0 flex-col gap-1 lg:flex">
          {SETTINGS_NAV.map(({ id, label, description, icon: Icon, badge }) => {
            const isActive = id === activeSection;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150",
                  isActive
                    ? "bg-accent/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                    isActive
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : "border-border/50 bg-muted/30 text-muted-foreground group-hover:border-border group-hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-tight">{label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {description}
                  </span>
                </div>
                {isActive && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Mobile: horizontal pill bar (shown below lg) */}
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border/50 bg-muted/20 p-1 lg:hidden">
          {SETTINGS_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                id === activeSection
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Right: content panel */}
        <div className="min-w-0 flex-1">
          {/* Section header */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10">
              <active.icon className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight">{active.label}</h2>
              <p className="text-[11px] text-muted-foreground">{active.description}</p>
            </div>
          </div>

          {renderContent(activeSection)}
        </div>
      </div>
    </Container>
  );
}
