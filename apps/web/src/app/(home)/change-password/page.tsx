"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { useAuth } from "@/lib/auth";
import type { UserResponse } from "@/client/types.gen";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || state.loading) return;

    if (!state.user) {
      router.replace("/sign-in");
      return;
    }

    const user = state.user as UserResponse;
    if (!user.must_change_password) {
      router.replace("/create");
    }
  }, [mounted, state.loading, state.user, router]);

  if (!mounted || state.loading) {
    return (
      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4">
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  if (!state.user) {
    return null;
  }

  const user = state.user as UserResponse;
  if (!user.must_change_password) {
    return null;
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,119,198,0.1)_0%,transparent_100%)]" />
      </div>

      <AuthCard
        title="Set your password"
        description="For security, please create a new password to continue using Rune."
      >
        <ChangePasswordForm />
      </AuthCard>
    </div>
  );
}
