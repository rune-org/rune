import Link from "next/link";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = {
  title: "Create your Rune account",
};

export default function SignUpPage() {
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