"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, FileText, Search as SearchIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { DOCS_UI_STRINGS, type DocsLocale } from "@/lib/docs-locales";

interface PagefindSubResult {
  title: string;
  url: string;
  excerpt: string;
}

interface PagefindPage {
  url: string;
  meta: { title?: string };
  sub_results: PagefindSubResult[];
}

interface Pagefind {
  options: (options: object) => Promise<void>;
  debouncedSearch: (
    query: string,
    options?: object,
  ) => Promise<{ results: { data: () => Promise<PagefindPage> }[] } | null>;
}

declare global {
  interface Window {
    pagefind?: Pagefind;
  }
}

const DEV_NOTICE =
  "Search index not found. Run `pnpm build` once — Pagefind indexes the built pages.";

function cleanUrl(url: string): string {
  return url.replace(/\.html$/, "").replace(/\.html#/, "#");
}

async function loadPagefind(): Promise<Pagefind> {
  if (!window.pagefind) {
    const pagefindPath = "/_pagefind/pagefind.js";
    window.pagefind = (await import(/* webpackIgnore: true */ pagefindPath)) as Pagefind;
    await window.pagefind.options({ baseUrl: "/" });
  }
  return window.pagefind;
}

export function DocsSearch({ locale }: { locale: DocsLocale }) {
  const ui = DOCS_UI_STRINGS[locale];
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<PagefindPage[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setMounted(true);
    setIsMac(navigator.userAgent.includes("Mac"));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isHotkey =
        event.key === "k" &&
        !event.shiftKey &&
        (navigator.userAgent.includes("Mac") ? event.metaKey : event.ctrlKey);
      if (!isHotkey) return;
      event.preventDefault();
      setActive((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    if (active) inputRef.current?.focus({ preventScroll: true });
  }, [active]);

  useEffect(() => {
    if (!deferredQuery) {
      setPages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pagefind = await loadPagefind();
        const response = await pagefind.debouncedSearch(deferredQuery, {
          filters: { lang: locale },
        });
        if (!response || cancelled) return; // superseded by a newer search
        const data = await Promise.all(response.results.slice(0, 12).map((r) => r.data()));
        if (cancelled) return;
        setError("");
        setPages(data);
        setExpanded(data.length ? { [data[0].url]: true } : {});
      } catch {
        if (!cancelled) setError(DEV_NOTICE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deferredQuery, locale]);

  const close = () => setActive(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setActive(true)}
        className={cn(
          "relative flex w-full max-w-xl items-center rounded-lg ps-9 pe-16 py-2",
          "bg-black/[.05] dark:bg-gray-50/10 text-sm text-muted-foreground text-start",
          "hover:bg-black/[.08] dark:hover:bg-gray-50/15 transition-colors",
        )}
      >
        <SearchIcon className="absolute start-3 h-4 w-4 pointer-events-none" />
        <span className="truncate">{ui.searchPlaceholder}</span>
        <kbd
          className={cn(
            "absolute end-2 flex items-center gap-1 rounded border border-border bg-background",
            "px-1.5 h-5 font-mono text-[11px] font-medium select-none max-sm:hidden",
          )}
        >
          {isMac ? "⌘ K" : "CTRL K"}
        </kbd>
      </button>

      {mounted &&
        active &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <div
              aria-hidden
              onMouseDown={close}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <div
              role="dialog"
              aria-modal="true"
              className={cn(
                "absolute top-[10vh] left-1/2 -translate-x-1/2 w-[min(90vw,40rem)]",
                "rounded-xl border border-foreground/60 bg-popover text-popover-foreground shadow-2xl",
              )}
            >
              <div className="relative flex items-center">
                <SearchIcon className="absolute start-4 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={inputRef}
                  type="search"
                  spellCheck={false}
                  autoComplete="off"
                  value={query}
                  placeholder={ui.searchPlaceholder}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") close();
                  }}
                  className={cn(
                    "w-full bg-transparent ps-11 pe-16 h-13 text-base",
                    "placeholder:text-muted-foreground outline-none",
                    "[&::-webkit-search-cancel-button]:appearance-none",
                  )}
                />
                <kbd
                  className={cn(
                    "absolute end-3 flex items-center rounded border border-border bg-background",
                    "px-1.5 h-5 font-mono text-[11px] font-medium text-muted-foreground select-none",
                  )}
                >
                  ESC
                </kbd>
              </div>

              <div className="max-h-[60vh] overflow-y-auto overscroll-contain border-t border-border py-1.5 empty:hidden">
                {query &&
                  (error ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">{error}</p>
                  ) : pages.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">{ui.noResults}</p>
                  ) : (
                    pages.map((page) => {
                      const isExpanded = expanded[page.url];
                      return (
                        <div key={page.url} className="px-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((prev) => ({ ...prev, [page.url]: !isExpanded }))
                            }
                            className={cn(
                              "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium",
                              "hover:bg-accent hover:text-accent-foreground",
                            )}
                          >
                            <ChevronRight
                              className={cn("h-3.5 w-3.5 shrink-0 transition-transform", {
                                "rotate-90": isExpanded,
                              })}
                            />
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-accent-foreground/75" />
                            <span className="truncate">
                              {page.meta.title || cleanUrl(page.url)}
                            </span>
                            <span className="ms-auto text-xs text-muted-foreground group-hover:text-accent-foreground/75">
                              {page.sub_results.length}
                            </span>
                          </button>
                          {isExpanded &&
                            page.sub_results.map((sub) => (
                              <Link
                                key={sub.url}
                                href={cleanUrl(sub.url)}
                                onClick={close}
                                className={cn(
                                  "group block rounded-md py-1.5 ps-9 pe-2",
                                  "hover:bg-accent hover:text-accent-foreground",
                                )}
                              >
                                <div className="text-sm truncate">{sub.title}</div>
                                <div
                                  className={cn(
                                    "text-xs truncate text-muted-foreground group-hover:text-accent-foreground/80",
                                    "[&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-primary",
                                    "group-hover:[&_mark]:text-accent-foreground group-hover:[&_mark]:underline",
                                  )}
                                  dangerouslySetInnerHTML={{ __html: sub.excerpt }}
                                />
                              </Link>
                            ))}
                        </div>
                      );
                    })
                  ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
