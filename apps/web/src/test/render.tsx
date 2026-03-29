import type { ReactElement, ReactNode } from "react";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return rtlRender(ui, { wrapper: Wrapper, ...options });
}

export * from "@testing-library/react";
