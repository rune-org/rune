import Link from "next/link";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = {
  title: "Create your Rune account",
};

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center py-12">
      <AuthCard
        title="Sign Up"
        description="Create your workspace and start building automation in minutes."
        footer={
          <span>
            Already have an account?{" "}
            <Link href="/sign-in" className="text-accent">
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
