"use client";

import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { DOCS_LOCALES, DOCS_UI_STRINGS, isDocsLocale } from "@/lib/docs-locales";

export function DocsLanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  const segments = pathname.split("/").filter(Boolean); // ["docs", locale, ...rest]
  const current = isDocsLocale(segments[1]) ? segments[1] : "en";
  const rest = segments.slice(2);

  const switchTo = (code: string) => {
    router.push(["/docs", code, ...rest].join("/"));
  };

  return (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <Globe className="h-4 w-4" aria-hidden />
      <select
        aria-label={DOCS_UI_STRINGS[current].languageLabel}
        value={current}
        onChange={(e) => switchTo(e.target.value)}
        className="bg-transparent outline-none cursor-pointer"
      >
        {DOCS_LOCALES.map((l) => (
          <option key={l.code} value={l.code} className="bg-background text-foreground">
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
