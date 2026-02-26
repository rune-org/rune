import { Layout } from 'nextra-theme-docs';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageMap = await getPageMap('/docs');

  return (
    <Layout
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/rune-org/rune"
      editLink={<a href="/not-found">Edit this page</a>}
      feedback={{
        content: <a href="/not-found">Question? Give us feedback →</a>,
        labels: 'feedback',
      }}
    >
      {children}
    </Layout>
  );
}
