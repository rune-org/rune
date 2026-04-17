import { Layout } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const pageMap = await getPageMap("/docs");

  return (
    <Layout
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/rune-org/rune"
      editLink={"Edit this page"}
      feedback={{
        content: "Question? Give us feedback",
        labels: "feedback",
      }}
    >
      {children}
    </Layout>
  );
}
