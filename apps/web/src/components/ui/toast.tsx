"use client";

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

const createToastWithIcon = (type: string) => {
  return (message: string | React.ReactNode, options?: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (sonnerToast as any)[type === "default" ? "message" : type](message, options);
  };
};

export const toast = Object.assign(
  (message: string | React.ReactNode, options?: Record<string, unknown>) => {
    return sonnerToast(message, options);
  },
  {
    success: createToastWithIcon("success"),
    error: createToastWithIcon("error"),
    warning: createToastWithIcon("warning"),
    info: createToastWithIcon("info"),
  }
);

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      theme="system"
      toastOptions={{
        classNames: {
          toast: "toast-base",
          success: "toast-success",
          error: "toast-error",
          warning: "toast-warning",
          info: "toast-info",
          default: "toast-neutral",
        },
      }}
    />
  );
}
