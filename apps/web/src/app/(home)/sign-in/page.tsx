"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { SignInForm } from "@/components/auth/SignInForm";
import { useAuth } from "@/lib/auth";
import { checkFirstTimeSetup } from "@/lib/api/auth";

export default function SignInPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkFirstTimeSetup().then(({ data }) => {
      setShowSignUp(data?.data ?? false);
    });
  }, []);

  useEffect(() => {
    if (mounted && !state.loading && state.user) {
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

  if (state.user) {
    return null;
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,119,198,0.1)_0%,transparent_100%)]" />
      </div>

      <AuthCard
        title="Welcome back"
        description="Sign in to continue building automation."
        footer={
          showSignUp ? (
            <span>
              New to Rune?{" "}
              <Link
                href="/sign-up"
                className="text-white hover:underline underline-offset-4 transition-all"
              >
                Create an account
              </Link>
            </span>
          ) : undefined
        }
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Loading...
            </div>
          }
        >
          <SignInForm />
        </Suspense>
      </AuthCard>
    </div>
  );
}
