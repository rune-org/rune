import type { NavItem, SocialLink } from "@/lib/types";

type FooterSection = Record<string, NavItem[]>;

export interface SiteConfig {
  name: string;
  tagline: string;
  description: string;
  mainNav: NavItem[];
  footer: FooterSection;
  socials: SocialLink[];
  legal: string;
}

export const siteConfig: SiteConfig = {
  name: "Rune",
  tagline: "Automate your workflows. Build smarter, faster.",
  description:
    "Rune is a low-code workflow automation platform.",
  mainNav: [
    { title: "Create", href: "/create" },
    { title: "Docs", href: "/docs" },
    { title: "Use Cases", href: "/use-cases" },
    { title: "Product", href: "/product" },
  ],
  footer: {
    product: [
      { title: "Workflows", href: "/workflows" },
      { title: "Templates", href: "/templates" },
      { title: "Docs", href: "/docs" },
    ],
    company: [
      { title: "About", href: "/about" },
      { title: "Security", href: "/security" },
      { title: "Privacy", href: "/privacy" },
    ],
    resources: [
      { title: "Guides", href: "/guides" },
      { title: "API Reference", href: "/api" },
      { title: "Changelog", href: "/changelog" },
      { title: "Community", href: "/community" },
    ],
    support: [
      { title: "Help Center", href: "/help" },
      { title: "Contact", href: "/contact" },
      { title: "Status", href: "/status" },
    ],
  },
  socials: [
    { title: "GitHub", href: "https://github.com/rune-org" },
    { title: "Twitter", href: "#" },
    { title: "Discord", href: "#" },
  ],
  legal: `© ${new Date().getFullYear()} Rune. All rights reserved.`,
};
