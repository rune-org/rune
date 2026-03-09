import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const eslintConfig = tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/client/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    plugins: nextPlugin.configs["core-web-vitals"].plugins,
    rules: nextPlugin.configs["core-web-vitals"].rules,
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    plugins: reactHooksPlugin.configs["recommended-latest"].plugins,
    rules: reactHooksPlugin.configs["recommended-latest"].rules,
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_|^err|^error",
        },
      ],
    },
  },
);

export default eslintConfig;
