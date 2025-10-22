import Link from "next/link";

import { AuthCard } from "@/components/auth/AuthCard";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata = {
  title: "Sign in to Rune",
};

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center py-12">
      <AuthCard
        title="Welcome back"
        description="Sign in to continue building automation."
        footer={
          <span>
            New to Rune?{" "}
            <Link href="/sign-up" className="text-accent">
              Create an account
            </Link>
          </span>
        }
      >
        <SignInForm />
      </AuthCard>
    </div>
  );
}
