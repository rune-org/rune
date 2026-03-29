import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "next/image": fileURLToPath(new URL("./src/test/mocks/next-image.tsx", import.meta.url)),
      "next/link": fileURLToPath(new URL("./src/test/mocks/next-link.tsx", import.meta.url)),
      "next/navigation": fileURLToPath(
        new URL("./src/test/mocks/next-navigation.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      reporter: ["text", "lcov"],
      exclude: ["src/client/**", "src/test/**"],
    },
  },
});
