"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Home,
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

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = isItemActive(pathname, item);

  const content = item.renderIcon
    ? item.renderIcon(isActive)
    : item.icon && <item.icon className="h-5 w-5" aria-hidden />;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition-colors",
        isActive
          ? "border-accent/60 bg-accent/15 text-accent"
          : "hover:border-border/70 hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {content}
      <span className="sr-only">{item.title}</span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-20 flex-col border-r border-border/60 bg-background/95 backdrop-blur lg:flex">
      <div className="flex h-full flex-col justify-between py-6">
        <nav className="flex flex-col items-center gap-3 px-2">
          {topNav.map((item) => (
            <NavLink key={item.title} item={item} pathname={pathname} />
          ))}
        </nav>
        <nav className="flex flex-col items-center gap-3 px-2">
          {bottomNav.map((item) => (
            <NavLink key={item.title} item={item} pathname={pathname} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
