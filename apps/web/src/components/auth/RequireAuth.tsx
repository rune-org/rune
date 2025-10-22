"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { state, initialize } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!state.loading && !state.user) {
      const redirect = pathname && pathname !== "/sign-in" ? `?redirect=${encodeURIComponent(pathname)}` : "";
      router.replace(`/sign-in${redirect}`);
    }
  }, [state.loading, state.user, router, pathname]);

  if (state.loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Checking authentication…
      </div>
    );
  }

  if (!state.user) {
    return null;
  }

  return <>{children}</>;
}
