"use client";

import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

type ToastType = "success" | "error" | "warning" | "info";

const createToastVariant = (type: ToastType) => sonnerToast[type];

export const toast = Object.assign(
  (message: string | React.ReactNode, options?: Record<string, unknown>) => {
    return sonnerToast(message, options);
  },
  sonnerToast,
  {
    success: createToastVariant("success"),
    error: createToastVariant("error"),
    warning: createToastVariant("warning"),
    info: createToastVariant("info"),
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
