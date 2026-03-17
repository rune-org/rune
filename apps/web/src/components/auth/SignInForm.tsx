"use client";

import { useEffect } from "react";

import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/lib/auth";

const ALLOWED_REDIRECTS = ["/create", "/create/app", "/profile", "/admin"] as const;

function getValidatedRedirectTarget(redirectParam: string | null): (typeof ALLOWED_REDIRECTS)[number] {
  const isAllowed = (p: string | null): p is (typeof ALLOWED_REDIRECTS)[number] =>
    !!p && ALLOWED_REDIRECTS.includes(p as (typeof ALLOWED_REDIRECTS)[number]);
  return isAllowed(redirectParam) ? redirectParam : "/create";
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, login } = useAuth();
  const { register, handleSubmit, setValue } = useForm<{
    email: string;
    password: string;
  }>();

  useEffect(() => {
    if (state.isSsoOnly) {
      setValue("password", "");
    }
  }, [state.isSsoOnly, setValue]);

  async function onSubmit(values: { email: string; password: string }) {
    const ok = await login(values.email, values.password);
    if (ok) {
      // Redirect to /create - RequireAuth will handle redirecting to
      // /change-password if the user needs to change their password
      const redirectParam = searchParams.get("redirect");
      const target = getValidatedRedirectTarget(redirectParam);
      router.push(target);
    }
  }

  function handleSsoSignIn() {
    const redirectParam = searchParams.get("redirect");
    const target = getValidatedRedirectTarget(redirectParam);
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    window.location.href = `${apiBaseUrl}/auth/saml/login?redirect=${encodeURIComponent(target)}`;
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-zinc-400">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          {...register("email")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-zinc-400">
          Password
        </Label>
        <PasswordInput
          id="password"
          placeholder="••••••••"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          {...register("password")}
        />
      </div>
      {state.isSsoOnly ? (
        <div className="space-y-4 pt-2">
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
            <p className="text-xs text-blue-400 font-medium" role="alert">
              Your account uses Single Sign-On (SSO). Please sign in through your
              organization&apos;s identity provider.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-full border-white/10 text-white hover:bg-white/5 font-medium transition-all"
            onClick={handleSsoSignIn}
          >
            Sign in with SSO
          </Button>
        </div>
      ) : null}

      {!state.isSsoOnly && state.error ? (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-xs text-red-400 font-medium" role="alert">
            {state.error}
          </p>
        </div>
      ) : null}

      {!state.isSsoOnly && (
        <div className="space-y-3">
          <Button
            type="submit"
            className="w-full h-11 rounded-full bg-white !text-black hover:bg-zinc-200 font-medium transition-all shadow-lg"
            disabled={state.loading}
          >
            {state.loading ? "Signing in…" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-full border-white/10 text-white hover:bg-white/5 font-medium transition-all"
            onClick={handleSsoSignIn}
          >
            Sign in with SSO
          </Button>
        </div>
      )}
    </form>
  );
}
