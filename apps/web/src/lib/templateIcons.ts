import {
  BarChart3,
  Calendar,
  Cloud,
  Code,
  FileText,
  Mail,
  Rocket,
  Share2,
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

export function resolveTemplateIcon(opts: {
  icon?: string | null;
  category: string;
}): LucideIcon {
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
];
