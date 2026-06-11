import { Layout, LastUpdated } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import "./docs.css";
import { DocsNavbar } from "@/components/layout/DocsNavbar";
import { Footer } from "@/components/layout/Footer";
import { DOCS_UI_STRINGS, isDocsLocale } from "@/lib/docs-locales";

export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ mdxPath?: string[] }>;
}) {
  const { mdxPath } = await params;
  const locale = isDocsLocale(mdxPath?.[0]) ? mdxPath![0] : "en";
  const pageMap = await getPageMap(`/docs/${locale}`);
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
