"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/**
 * RequireAdmin guard component for admin-only routes.
 *
 * Centralizes the admin role check to avoid duplication across admin pages.
 * - Checks if user is authenticated and has admin role
 * - Redirects non-admin users to /create
 * - Shows loading state while checking authentication
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  const currentUser = state.user;

  // Redirect non-admin users
  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      router.replace("/create");
    }
  }, [currentUser, router]);

  // Show loading state while auth is being checked
  if (!currentUser) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  // Block rendering for non-admin (will redirect)
  if (currentUser.role !== "admin") {
    return null;
  }

  return <>{children}</>;
}
