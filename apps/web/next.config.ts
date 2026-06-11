import type { NextConfig } from "next";
import nextra from 'nextra';
import { DEFAULT_DOCS_LOCALE, DOCS_LOCALES } from "./src/lib/docs-locales";

const docsLocaleCodes = DOCS_LOCALES.map((l) => l.code).join("|");

// Nextra v4 configuration
const withNextra = nextra({
  contentDirBasePath: '/docs',
  mdxOptions: {
    rehypePlugins: [],
  },
});

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  turbopack: {
    resolveAlias: {
      'next-mdx-import-source-file': './mdx-components.tsx',
    },
  },
  async redirects() {
    return [
      {
        source: `/docs/${DEFAULT_DOCS_LOCALE}`,
        destination: "/docs",
        permanent: false,
      },
      {
        source: `/docs/${DEFAULT_DOCS_LOCALE}/:path*`,
        destination: "/docs/:path*",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || "http://localhost:8000";
    return {
      beforeFiles: [
        {
          source: "/docs",
          destination: `/docs/${DEFAULT_DOCS_LOCALE}`,
        },
        {
          source: `/docs/:path((?!(?:${docsLocaleCodes})(?![^/]))[^/]+)/:rest*`,
          destination: `/docs/${DEFAULT_DOCS_LOCALE}/:path/:rest*`,
        },
      ],
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${target}/:path*`,
        },
      ],
    };
  },
};

export default withNextra(nextConfig);
