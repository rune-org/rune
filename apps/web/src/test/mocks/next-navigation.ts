import { vi } from "vitest";

type SearchParamsInput = Record<string, string | null | undefined> | URLSearchParams | string;

let pathname = "/";
let searchParams = new URLSearchParams();

export const router = {
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn<(href: string) => Promise<void>>().mockResolvedValue(undefined),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

export function useRouter() {
  return router;
}

export function usePathname() {
  return pathname;
}

export function useSearchParams() {
  return searchParams;
}

export function setPathname(nextPathname: string) {
  pathname = nextPathname;
}

export function setSearchParams(input: SearchParamsInput) {
  if (typeof input === "string") {
    searchParams = new URLSearchParams(input);
    return;
  }

  if (input instanceof URLSearchParams) {
    searchParams = new URLSearchParams(input);
    return;
  }

  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value != null) {
      next.set(key, value);
    }
  }
  searchParams = next;
}

export function resetNavigationMocks() {
  pathname = "/";
  searchParams = new URLSearchParams();
  router.back.mockReset();
  router.forward.mockReset();
  router.prefetch.mockReset();
  router.prefetch.mockResolvedValue(undefined);
  router.push.mockReset();
  router.refresh.mockReset();
  router.replace.mockReset();
}
