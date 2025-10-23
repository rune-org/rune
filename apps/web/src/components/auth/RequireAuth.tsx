"use client";

import { useEffect, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthContext } from "@/lib/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const ctx = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If provider is missing, send a clear message rather than crash
    if (!ctx) {
      console.error(
        "RequireAuth: AuthProvider is not mounted. Wrap the app in <ClientProviders>.",
      );
      router.replace("/sign-in");
      return;
    }
    void ctx.initialize();
  }, [ctx, router]);

  useEffect(() => {
    if (!ctx) return;
    if (!ctx.state.loading && !ctx.state.user) {
      const redirect = pathname && pathname !== "/sign-in" ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/sign-in${redirect}`);
    }
  }, [ctx, router, pathname]);

  if (!ctx || ctx.state.loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Checking authentication…
      </div>
    );
  }

  if (!ctx.state.user) {
    return null;
  }

  return <>{children}</>;
}
