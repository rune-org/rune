import { vi } from "vitest";

type ExecCommand = (commandId: string) => boolean;

const baseLocation = {
  hash: "",
  host: "localhost",
  hostname: "localhost",
  href: "http://localhost/",
  origin: "http://localhost",
  pathname: "/",
  port: "",
  protocol: "http:",
  search: "",
};

export const locationMock = {
  ...baseLocation,
  ancestorOrigins: {} as DOMStringList,
  assign: vi.fn<(url: string | URL) => void>(),
  reload: vi.fn<() => void>(),
  replace: vi.fn<(url: string | URL) => void>(),
  toString() {
    return locationMock.href;
  },
} as unknown as Location & {
  assign: ReturnType<typeof vi.fn<(url: string | URL) => void>>;
  reload: ReturnType<typeof vi.fn<() => void>>;
  replace: ReturnType<typeof vi.fn<(url: string | URL) => void>>;
};

export const clipboardWriteTextMock = vi.fn<(text: string) => Promise<void>>();
export const createObjectURLMock = vi.fn<(blob: Blob | MediaSource) => string>();
export const revokeObjectURLMock = vi.fn<(url: string) => void>();
export const execCommandMock = vi.fn<ExecCommand>();

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

class IntersectionObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}

  takeRecords() {
    return [];
  }

  root = null;
  rootMargin = "0px";
  thresholds = [0];
}

export function setupBrowserMocks() {
  createObjectURLMock.mockReturnValue("blob:mock-url");
  execCommandMock.mockReturnValue(true);
  clipboardWriteTextMock.mockResolvedValue(undefined);

  Object.defineProperty(window, "location", {
    configurable: true,
    value: locationMock,
  });

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });

  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: IntersectionObserverMock,
  });

  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });

  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: clipboardWriteTextMock,
    },
  });

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: createObjectURLMock,
  });

  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: revokeObjectURLMock,
  });

  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: execCommandMock,
  });

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}

export function resetBrowserMocks() {
  Object.assign(locationMock, baseLocation);
  locationMock.assign.mockReset();
  locationMock.replace.mockReset();
  locationMock.reload.mockReset();
  clipboardWriteTextMock.mockReset();
  clipboardWriteTextMock.mockResolvedValue(undefined);
  createObjectURLMock.mockReset();
  createObjectURLMock.mockReturnValue("blob:mock-url");
  revokeObjectURLMock.mockReset();
  execCommandMock.mockReset();
  execCommandMock.mockReturnValue(true);
}
