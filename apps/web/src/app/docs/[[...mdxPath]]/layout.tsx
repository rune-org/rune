import { Layout, LastUpdated } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import type { PageMapItem } from "nextra";
import "nextra-theme-docs/style.css";
import "./docs.css";
import { DocsNavbar } from "@/components/layout/DocsNavbar";
import { Footer } from "@/components/layout/Footer";
import {
  DEFAULT_DOCS_LOCALE,
  DOCS_UI_STRINGS,
  isDocsLocale,
  stripDefaultLocalePrefix,
} from "@/lib/docs-locales";

function stripEnPrefix<T extends PageMapItem>(item: T): T {
  const result = { ...item };
  if ("route" in result && typeof result.route === "string") {
    result.route = stripDefaultLocalePrefix(result.route);
  }
  if ("children" in result && Array.isArray(result.children)) {
    result.children = result.children.map(stripEnPrefix);
  }
  return result;
}

export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ mdxPath?: string[] }>;
}) {
  const { mdxPath } = await params;
  const locale = isDocsLocale(mdxPath?.[0]) ? mdxPath![0] : DEFAULT_DOCS_LOCALE;
  const rawPageMap = await getPageMap(`/docs/${locale}`);
  const pageMap = locale === DEFAULT_DOCS_LOCALE ? rawPageMap.map(stripEnPrefix) : rawPageMap;
  const ui = DOCS_UI_STRINGS[locale];

  return (
    <Layout
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/rune-org/rune/tree/main/apps/web"
      editLink={ui.editLink}
      darkMode={false}
      sidebar={{
        defaultMenuCollapseLevel: 1,
        toggleButton: false,
      }}
      navbar={<DocsNavbar key="navbar" />}
      footer={<Footer key="footer" />}
      toc={{
        title: ui.tocTitle,
        backToTop: ui.backToTop,
      }}
      lastUpdated={
        <LastUpdated key="last-updated" locale={locale}>
          {ui.lastUpdated}
        </LastUpdated>
      }
      feedback={{
        content: ui.feedback,
        labels: "feedback",
      }}
    >
      <div
        key="content"
        lang={locale}
        dir={locale === "ar" ? "rtl" : "ltr"}
        data-pagefind-filter={`lang:${locale}`}
      >
        {children}
      </div>
    </Layout>
  );
}
