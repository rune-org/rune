"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/lib/auth";
import { checkFirstTimeSetup } from "@/lib/api/auth";

export default function SignUpPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    checkFirstTimeSetup().then(({ data }) => {
      if (!data?.data) {
        router.replace("/sign-in");
      } else {
        setCheckingSetup(false);
      }
    });
  }, [mounted, router]);

  useEffect(() => {
    if (mounted && !state.loading && state.user) {
      router.replace("/create");
    }
  }, [mounted, state.loading, state.user, router]);

  if (!mounted || state.loading || checkingSetup) {
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
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center pt-24 pb-12 px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,119,198,0.1)_0%,transparent_100%)]" />
      </div>

      <AuthCard
        title="Join Rune"
        description="Create your workspace and start building automation in minutes."
        footer={
          <span>
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-white hover:underline underline-offset-4 transition-all"
            >
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
