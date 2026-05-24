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
 * Icon resolution for template cards. Templates ship with an optional ``icon``
 * field naming a Lucide icon; we map a small allowlist here so bundle size
 * stays bounded. Anything else falls back to a category default, and
 * uncategorised templates get a generic FileText.
 */

const ICONS_BY_NAME: Record<string, LucideIcon> = {
  Mail,
  BarChart3,
  Code,
  Cloud,
  Calendar,
  Share2,
  Rocket,
  FileText,
};

const ICONS_BY_CATEGORY: Record<string, LucideIcon> = {
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
  if (opts.icon && ICONS_BY_NAME[opts.icon]) return ICONS_BY_NAME[opts.icon];
  return ICONS_BY_CATEGORY[opts.category] ?? FileText;
}
