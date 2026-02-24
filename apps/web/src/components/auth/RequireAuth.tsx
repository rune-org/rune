"use client";

import { useEffect, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { AuthContext } from "@/lib/auth";
import type { UserResponse } from "@/client/types.gen";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const ctx = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If provider is missing, send a clear message rather than crash
    if (!ctx) {
      toast.error("Authentication system not initialized");
      router.replace("/sign-in");
      return;
    }
    ctx.initialize().catch((err) => {
      toast.error("Authentication failed");
    });
  }, [ctx, router]);

  useEffect(() => {
    if (!ctx) return;
    if (!ctx.state.loading && !ctx.state.user) {
      const redirect = pathname && pathname !== "/sign-in" ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/sign-in${redirect}`);
    }
  }, [ctx, router, pathname]);

  // Redirect to change password page if user must change their password
  useEffect(() => {
    if (!ctx || ctx.state.loading || !ctx.state.user) return;

    const user = ctx.state.user as UserResponse;
    if (user.must_change_password) {
      router.replace("/change-password");
    }
  }, [ctx, ctx?.state.user, router]);

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

  // Block rendering if user must change password (will redirect)
  const user = ctx.state.user as UserResponse;
  if (user.must_change_password) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Everything is temporary.. even your password.
      </div>
    );
  }

  return <>{children}</>;
}
