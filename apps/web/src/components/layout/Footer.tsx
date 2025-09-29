import Link from "next/link";

import { Container } from "@/components/shared/Container";
import { Logo } from "@/components/shared/Logo";
import { siteConfig } from "@/lib/site";

const socialIconMap: Record<string, string> = {
  github: "/icons/social/github.svg",
  twitter: "/icons/social/twitter-x.svg",
  discord: "/icons/social/discord.svg",
};

function SocialIcon({ name }: { name: string }) {
  const src = socialIconMap[name.toLowerCase()] ?? socialIconMap.github;

  return (
    <span
      aria-hidden
      className="block h-5 w-5"
      style={{
        mask: `url(${src}) no-repeat center / contain`,
        WebkitMask: `url(${src}) no-repeat center / contain`,
        backgroundColor: "currentColor",
      }}
    />
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background/60">
      <Container className="flex flex-col gap-12 py-9">
        <div className="flex flex-col items-center gap-6 text-center">
          <p className="font-display text-4xl tracking-tight">
            Automate your world.
          </p>
        </div>
        <div className="grid gap-10 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-start gap-6 border-border/60 md:border-r md:pr-8">
            <Logo className="h-9" />
            <p className="text-sm text-muted-foreground text-left max-w-xs">
              {siteConfig.tagline}
            </p>
            <div className="flex items-center gap-3 text-muted-foreground">
              {siteConfig.socials.map((social) => (
                <Link
                  key={social.title}
                  href={social.href}
                  aria-label={social.title}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-accent/60 hover:text-accent"
                >
                  <SocialIcon name={social.title} />
                </Link>
              ))}
            </div>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(siteConfig.footer).map(([section, links]) => (
              <div key={section} className="flex flex-col gap-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {section}
                </p>
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  {links.map((link) => (
                    <li key={link.title}>
                      <Link href={link.href}>{link.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border/60 pt-6 text-center text-sm text-muted-foreground">
          {siteConfig.legal}
        </div>
      </Container>
    </footer>
  );
}
