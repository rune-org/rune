import type { NextConfig } from "next";
import nextra from 'nextra';

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
        source: "/docs/en",
        destination: "/docs",
        permanent: false,
      },
      {
        source: "/docs/en/:path*",
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
          destination: "/docs/en",
        },
        {
          source: "/docs/:path((?!(?:en|fr|es|ar|de)(?![^/]))[^/]+)/:rest*",
          destination: "/docs/en/:path/:rest*",
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
