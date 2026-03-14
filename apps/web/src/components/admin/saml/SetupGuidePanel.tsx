"use client";

import { ChevronRight, Info } from "lucide-react";

import type { SubTab } from "./types";

const SETUP_STEPS = [
  {
    n: 1,
    title: "Copy your Service Provider details to your IdP",
    desc: "Open the Service Provider tab and paste the ACS URL, Entity ID, and (optionally) SP certificate into your IdP application settings.",
    cta: "sp" as SubTab,
    ctaLabel: "Open Service Provider",
  },
  {
    n: 2,
    title: "Fill in your Identity Provider details",
    desc: "Grab the Entity ID, SSO URL, and signing certificate from your IdP metadata (Okta, Azure AD, Authentik, ADFS...). Paste them in the Identity Provider tab.",
    cta: "idp" as SubTab,
    ctaLabel: "Open Identity Provider",
  },
  {
    n: 3,
    title: "Optionally set an email domain hint",
    desc: "Users whose email belongs to that domain will be auto-redirected to SSO at sign-in - no need to click a separate 'Sign in with SSO' button.",
    cta: undefined,
  },
  {
    n: 4,
    title: "Enable & test",
    desc: "Flip the toggle at the top of this page. Open a private window, sign in with a domain-matching email, and confirm the SAML flow completes successfully before rolling out to your team.",
    cta: undefined,
  },
];

interface SetupGuidePanelProps {
  onNav: (tab: SubTab) => void;
}

export function SetupGuidePanel({ onNav }: SetupGuidePanelProps) {
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <p className="text-sm leading-relaxed text-blue-400/90">
          SAML 2.0 lets your team authenticate using your corporate identity provider.
          Complete the steps below to wire up the integration.
        </p>
      </div>

      <div className="grid gap-3">
        {SETUP_STEPS.map(({ n, title, desc, cta, ctaLabel }) => (
          <div
            key={n}
            className="flex gap-4 rounded-xl border border-border/50 bg-card px-5 py-4"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
              {n}
            </div>
            <div className="grid gap-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
              {cta && (
                <button
                  type="button"
                  onClick={() => onNav(cta)}
                  className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  {ctaLabel}
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
