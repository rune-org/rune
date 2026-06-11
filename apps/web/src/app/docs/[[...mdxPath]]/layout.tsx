import { Layout, LastUpdated } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import type { PageMapItem } from "nextra";
import "nextra-theme-docs/style.css";
import "./docs.css";
import { DocsNavbar } from "@/components/layout/DocsNavbar";
import { Footer } from "@/components/layout/Footer";
import { DOCS_UI_STRINGS, isDocsLocale } from "@/lib/docs-locales";

function stripEnPrefix<T extends PageMapItem>(item: T): T {
  const result = { ...item };
  if ("route" in result && typeof result.route === "string") {
    result.route = result.route.replace(/^\/docs\/en(?=\/|$)/, "/docs") || "/docs";
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
  const locale = isDocsLocale(mdxPath?.[0]) ? mdxPath![0] : "en";
  const rawPageMap = await getPageMap(`/docs/${locale}`);
  const pageMap = locale === "en" ? rawPageMap.map(stripEnPrefix) : rawPageMap;
  const ui = DOCS_UI_STRINGS[locale];

  return (
    <Layout
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/rune-org/rune/tree/main/apps/web/content"
      editLink={ui.editLink}
      sidebar={{
        defaultMenuCollapseLevel: 1,
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
