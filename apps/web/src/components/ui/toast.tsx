"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

export { toast };

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      theme="dark"
      toastOptions={{
        style: {
          backgroundColor: "hsl(220 35% 9%)",
          color: "hsl(210 20% 96%)",
          borderRadius: "var(--radius)",
          border: "1px solid hsl(220 25% 18%)",
        },
      }}
    />
  );
}
