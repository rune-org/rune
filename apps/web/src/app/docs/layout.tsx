import { Layout } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import { DocsNavbar } from "@/components/layout/DocsNavbar";
import { Footer } from "@/components/layout/Footer";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const pageMap = await getPageMap("/docs");

  return (
    <Layout
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/rune-org/rune"
      editLink="Edit this page"
      sidebar={{
        defaultMenuCollapseLevel: 1,
      }}
      navbar={<DocsNavbar />}
      footer={<Footer />}
      feedback={{
        content: "Question? Give us feedback",
        labels: "feedback",
      }}
    >
      {children}
    </Layout>
  );
}
