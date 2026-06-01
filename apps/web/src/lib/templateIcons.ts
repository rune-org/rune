import {
  BarChart3,
  Bell,
  Bot,
  Calendar,
  CalendarCheck,
  Cloud,
  Code,
  Database,
  FileText,
  Globe,
  Inbox,
  ListChecks,
  Mail,
  Rocket,
  Send,
  Share2,
  Sheet,
  ShieldAlert,
  Users,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react";

/**
 * Allowlist of icons templates can use. Kept intentionally small so adding a
 * template never pulls more icon code into the JS bundle. To expand: import
 * the Lucide icon, add to ``TEMPLATE_ICONS`` below.
 */

export const TEMPLATE_ICONS = {
  Mail,
  BarChart3,
  Code,
  Cloud,
  Calendar,
  Share2,
  Rocket,
  FileText,
  Sheet,
  Users,
  Bell,
  Database,
  Globe,
  Webhook,
  Bot,
  CalendarCheck,
  Send,
  Inbox,
  ListChecks,
  ShieldAlert,
  Workflow,
  sheet: Sheet,
  users: Users,
  alert: Bell,
  database: Database,
  http: Globe,
  webhook: Webhook,
  ai: Bot,
  schedule: CalendarCheck,
  send: Send,
  inbox: Inbox,
  tasks: ListChecks,
  security: ShieldAlert,
  workflow: Workflow,
} as const satisfies Record<string, LucideIcon>;

export type TemplateIconName = keyof typeof TEMPLATE_ICONS;

const CATEGORY_DEFAULT_ICON: Record<string, LucideIcon> = {
  general: FileText,
  email: Mail,
  analytics: BarChart3,
  development: Code,
  cloud: Cloud,
  scheduling: Calendar,
  social_media: Share2,
  productivity: Rocket,
};

export function resolveTemplateIcon(opts: { icon?: string | null; category: string }): LucideIcon {
  if (opts.icon && opts.icon in TEMPLATE_ICONS) {
    return TEMPLATE_ICONS[opts.icon as TemplateIconName];
  }
  return CATEGORY_DEFAULT_ICON[opts.category] ?? FileText;
}

export const TEMPLATE_ICON_OPTIONS: ReadonlyArray<{
  name: TemplateIconName;
  label: string;
  Icon: LucideIcon;
}> = [
  { name: "Mail", label: "Mail", Icon: Mail },
  { name: "BarChart3", label: "Analytics", Icon: BarChart3 },
  { name: "Code", label: "Code", Icon: Code },
  { name: "Cloud", label: "Cloud", Icon: Cloud },
  { name: "Calendar", label: "Calendar", Icon: Calendar },
  { name: "Share2", label: "Share", Icon: Share2 },
  { name: "Rocket", label: "Rocket", Icon: Rocket },
  { name: "FileText", label: "Document", Icon: FileText },
  { name: "sheet", label: "Sheet", Icon: Sheet },
  { name: "users", label: "Users", Icon: Users },
  { name: "alert", label: "Alert", Icon: Bell },
  { name: "database", label: "Database", Icon: Database },
  { name: "http", label: "HTTP", Icon: Globe },
  { name: "webhook", label: "Webhook", Icon: Webhook },
  { name: "ai", label: "AI", Icon: Bot },
  { name: "schedule", label: "Schedule", Icon: CalendarCheck },
  { name: "send", label: "Send", Icon: Send },
  { name: "inbox", label: "Inbox", Icon: Inbox },
  { name: "tasks", label: "Tasks", Icon: ListChecks },
  { name: "security", label: "Security", Icon: ShieldAlert },
  { name: "workflow", label: "Workflow", Icon: Workflow },
];
