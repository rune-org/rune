"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/lib/auth";

export default function SignUpPage() {
  const router = useRouter();
  const { state } = useAuth();

  useEffect(() => {
    if (!state.loading && state.user) {
      router.replace("/create");
    }
  }, [state.loading, state.user, router]);

  if (state.loading) {
    return (
      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4">
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  if (state.user) {
    return null;
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4">
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,119,198,0.1)_0%,transparent_100%)]" />
      </div>

      <AuthCard
        title="Join Rune"
        description="Create your workspace and start building automation in minutes."
        footer={
          <span>
            Already have an account?{" "}
            <Link href="/sign-in" className="text-white hover:underline underline-offset-4 transition-all">
              Log in
            </Link>
          </span>
        }
      >
        <AuthForm />
      </AuthCard>
    </div>
  );
}