import type { NextConfig } from "next";
import nextra from 'nextra';

// Nextra v4 configuration
const withNextra = nextra({
  mdxOptions: {
    rehypePlugins: [],
  },
});

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
};

export default withNextra(nextConfig);
