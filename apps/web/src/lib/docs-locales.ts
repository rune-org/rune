export const DOCS_LOCALES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
  { code: "de", label: "Deutsch" },
] as const;

export type DocsLocale = (typeof DOCS_LOCALES)[number]["code"];

export const DEFAULT_DOCS_LOCALE: DocsLocale = "en";

export function isDocsLocale(value: string | undefined): value is DocsLocale {
  return value !== undefined && DOCS_LOCALES.some((l) => l.code === value);
}

const defaultLocalePrefix = new RegExp(`^/docs/${DEFAULT_DOCS_LOCALE}(?=[/#]|$)`);

export function stripDefaultLocalePrefix(url: string): string {
  return url.replace(defaultLocalePrefix, "/docs");
}

interface DocsUiStrings {
  editLink: string;
  feedback: string;
  tocTitle: string;
  backToTop: string;
  lastUpdated: string;
  searchPlaceholder: string;
  noResults: string;
  languageLabel: string;
}

export const DOCS_UI_STRINGS: Record<DocsLocale, DocsUiStrings> = {
  en: {
    editLink: "Edit this page",
    feedback: "Question? Give us feedback",
    tocTitle: "On This Page",
    backToTop: "Scroll to top",
    lastUpdated: "Last updated on",
    searchPlaceholder: "Search docs…",
    noResults: "No results found.",
    languageLabel: "Documentation language",
  },
  fr: {
    editLink: "Modifier cette page",
    feedback: "Une question ? Donnez-nous votre avis",
    tocTitle: "Sur cette page",
    backToTop: "Retour en haut",
    lastUpdated: "Dernière mise à jour le",
    searchPlaceholder: "Rechercher dans la doc…",
    noResults: "Aucun résultat.",
    languageLabel: "Langue de la documentation",
  },
  es: {
    editLink: "Editar esta página",
    feedback: "¿Preguntas? Envíanos tu opinión",
    tocTitle: "En esta página",
    backToTop: "Volver arriba",
    lastUpdated: "Última actualización el",
    searchPlaceholder: "Buscar en la documentación…",
    noResults: "Sin resultados.",
    languageLabel: "Idioma de la documentación",
  },
  ar: {
    editLink: "تحرير هذه الصفحة",
    feedback: "سؤال؟ شاركنا رأيك",
    tocTitle: "في هذه الصفحة",
    backToTop: "العودة إلى الأعلى",
    lastUpdated: "آخر تحديث في",
    searchPlaceholder: "ابحث في التوثيق…",
    noResults: "لا توجد نتائج.",
    languageLabel: "لغة التوثيق",
  },
  de: {
    editLink: "Diese Seite bearbeiten",
    feedback: "Fragen? Gib uns Feedback",
    tocTitle: "Auf dieser Seite",
    backToTop: "Nach oben scrollen",
    lastUpdated: "Zuletzt aktualisiert am",
    searchPlaceholder: "Dokumentation durchsuchen…",
    noResults: "Keine Ergebnisse gefunden.",
    languageLabel: "Sprache der Dokumentation",
  },
};

export function docsLocaleFromPath(pathname: string): DocsLocale {
  const segments = pathname.split("/").filter(Boolean);
  return isDocsLocale(segments[1]) ? segments[1] : DEFAULT_DOCS_LOCALE;
}
