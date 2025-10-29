"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  Home,
  Key,
  LayoutGrid,
  Play,
  Settings,
  User,
  Workflow,
} from "lucide-react";

import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/cn";

type NavItem = {
  title: string;
  href: string;
  icon?: LucideIcon;
  exact?: boolean;
  renderIcon?: (isActive: boolean) => ReactNode;
};

const topNav: NavItem[] = [
  {
    title: "Create",
    href: "/create",
    exact: true,
    renderIcon(isActive) {
      return (
        <Logo
          href=""
          variant="glyph"
          wrapperClassName={cn(
            "inline-flex h-6 w-6 items-center justify-center",
            isActive ? "opacity-100" : "opacity-90",
          )}
          className="h-6 w-6"
        />
      );
    },
  },
  { title: "Workflows", href: "/create/workflows", icon: Workflow },
  { title: "Executions", href: "/create/executions", icon: Play },
  { title: "Credentials", href: "/create/credentials", icon: Key },
  { title: "Templates", href: "/create/templates", icon: LayoutGrid },
  { title: "Docs", href: "/create/docs", icon: BookOpen },
];

const bottomNav: NavItem[] = [
  { title: "Home", href: "/", icon: Home, exact: true },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Profile", href: "/profile", icon: User },
];

function isItemActive(pathname: string, item: NavItem) {
  const normalizedPath =
    pathname.endsWith("/") && pathname.length > 1
      ? pathname.slice(0, -1)
      : pathname;
  const normalizedHref =
    item.href.endsWith("/") && item.href.length > 1
      ? item.href.slice(0, -1)
      : item.href;

  if (item.exact) {
    return normalizedPath === normalizedHref;
  }

  return (
    normalizedPath === normalizedHref ||
    normalizedPath.startsWith(`${normalizedHref}/`)
  );
}

function NavLink({
  item,
  pathname,
  isExpanded,
}: {
  item: NavItem;
  pathname: string;
  isExpanded: boolean;
}) {
  const isActive = isItemActive(pathname, item);

  const content = item.renderIcon
    ? item.renderIcon(isActive)
    : item.icon && <item.icon className="h-5 w-5" aria-hidden={true} />;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex h-12 w-full items-center rounded-xl border border-transparent text-sm font-medium text-muted-foreground motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isExpanded ? "justify-start gap-3 px-3" : "justify-center gap-0 px-0",
        isActive
          ? "border-accent/60 bg-accent/15 text-accent"
          : "hover:border-border/70 hover:bg-muted/40 hover:text-foreground",
      )}
    >
      <span
        aria-hidden={true}
        className="flex h-5 w-5 items-center justify-center text-inherit"
      >
        {content}
      </span>
      <span
        aria-hidden={!isExpanded}
        className={cn(
          "pointer-events-none select-none overflow-hidden whitespace-nowrap text-sm font-medium motion-safe:transition-[margin,max-width,opacity,transform] motion-safe:duration-200 motion-safe:ease-out",
          isExpanded
            ? "ml-1.5 max-w-[12rem] translate-x-0 opacity-100"
            : "ml-0 max-w-0 -translate-x-1 opacity-0",
        )}
      >
        {item.title}
      </span>
      {!isExpanded && <span className="sr-only">{item.title}</span>}
      {!isExpanded && (
        <span
          aria-hidden={true}
          className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 rounded-[calc(var(--radius)-0.25rem)] border border-border/70 bg-background/95 px-2 py-1 text-xs font-medium text-muted-foreground opacity-0 shadow-sm motion-safe:transition-all motion-safe:duration-150 motion-safe:ease-out group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {item.title}
        </span>
      )}
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    try {
      setIsExpanded(window.localStorage.getItem("sidebar:expanded") === "1");
    } catch {}
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("sidebar:expanded", next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen flex-shrink-0 flex-col overflow-visible border-r border-border/60 bg-background/95 backdrop-blur motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out lg:flex",
        isExpanded ? "w-60" : "w-20",
      )}
    >
      <div className="flex h-full flex-col justify-between py-6">
        <div className="flex flex-col gap-4">
          <div
            className={cn(
              "flex items-center px-2",
              isExpanded ? "justify-between" : "justify-center",
            )}
          >
            {isExpanded && (
              <span className="pl-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Navigation
              </span>
            )}
            <button
              type="button"
              onClick={toggleExpanded}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground cursor-pointer",
                "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              )}
              aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronsLeft className="h-5 w-5" aria-hidden={true} />
              ) : (
                <ChevronsRight className="h-5 w-5" aria-hidden={true} />
              )}
              <span className="sr-only">
                {isExpanded ? "Collapse" : "Expand"}
              </span>
            </button>
          </div>
          <nav className="flex flex-col items-stretch gap-3 px-2">
            {topNav.map((item) => (
              <NavLink
                key={item.title}
                item={item}
                pathname={pathname}
                isExpanded={isExpanded}
              />
            ))}
          </nav>
        </div>
        <nav className="flex flex-col items-stretch gap-3 px-2">
          {bottomNav.map((item) => (
            <NavLink
              key={item.title}
              item={item}
              pathname={pathname}
              isExpanded={isExpanded}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}
