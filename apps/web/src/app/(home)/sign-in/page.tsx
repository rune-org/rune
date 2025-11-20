import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/AuthCard";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata = {
  title: "Sign in to Rune",
};

export default function SignInPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center py-12 px-4">
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,119,198,0.1)_0%,transparent_100%)]" />
      </div>

      <AuthCard
        title="Welcome back"
        description="Sign in to continue building automation."
        footer={
          <span>
            New to Rune?{" "}
            <Link href="/sign-up" className="text-white hover:underline underline-offset-4 transition-all">
              Create an account
            </Link>
          </span>
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