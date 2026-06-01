/**
 * Canonical list of template categories. Mirrors the ``TemplateCategory`` enum
 * in ``services/api/src/templates/categories.py``. Kept hand-synced rather
 * than fetched from ``/templates/categories`` because the list is small,
 * stable, and the dialog needs labels (humanised display names) that the
 * enum values alone don't carry.
 */
export type TemplateCategoryOption = {
  value: string;
  label: string;
};

export const TEMPLATE_CATEGORIES: ReadonlyArray<TemplateCategoryOption> = [
  { value: "general", label: "General" },
  { value: "email", label: "Email" },
  { value: "analytics", label: "Analytics" },
  { value: "development", label: "Development" },
  { value: "cloud", label: "Cloud" },
  { value: "scheduling", label: "Scheduling" },
  { value: "social_media", label: "Social media" },
  { value: "productivity", label: "Productivity" },
];
