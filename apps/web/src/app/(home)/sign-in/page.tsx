import Link from "next/link";

import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        <form className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@company.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </AuthCard>
    </div>
  );
}
