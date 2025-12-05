"use client";

import { useActionState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

type FormState = {
  error: string | null;
};

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  async function signInAction(
    _prevState: FormState,
    formData: FormData
  ): Promise<FormState> {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      return { error: "Email and password are required" };
    }

    const ok = await login(email, password);
    if (ok) {
      const redirectParam = searchParams.get("redirect");
      const allowed = [
        "/create",
        "/create/app",
        "/profile",
        "/settings",
        "/admin",
      ] as const;
      const isAllowed = (p: string | null): p is (typeof allowed)[number] =>
        !!p && allowed.includes(p as (typeof allowed)[number]);
      const target = isAllowed(redirectParam) ? redirectParam : "/create";
      router.push(target);
      return { error: null };
    }

    return { error: "Invalid email or password" };
  }

  const [state, formAction, isPending] = useActionState(signInAction, {
    error: null,
  });

  return (
    <form className="space-y-5" noValidate action={formAction}>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-zinc-400">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@company.com"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-zinc-400">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
        />
      </div>
      {state.error ? (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-xs text-red-400 font-medium" role="alert">
            {state.error}
          </p>
        </div>
      ) : null}

      <Button
        type="submit"
        className="w-full h-11 rounded-full bg-white !text-black hover:bg-zinc-200 font-medium transition-all shadow-lg"
        disabled={isPending}
      >
        Sign in
      </Button>
    </form>
  );
}
