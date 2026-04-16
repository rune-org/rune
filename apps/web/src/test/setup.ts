import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

import { resetBrowserMocks, setupBrowserMocks } from "@/test/mocks/browser";
import { resetNavigationMocks } from "@/test/mocks/next-navigation";

beforeAll(() => {
  setupBrowserMocks();
});

afterEach(() => {
  cleanup();
  resetBrowserMocks();
  resetNavigationMocks();
});
