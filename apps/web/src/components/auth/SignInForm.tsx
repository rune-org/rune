"use client";

import { startTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { signInSchema, type SignInFormValues } from "@/lib/validation";
import { useAuth } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";

const ALLOWED_REDIRECTS = ["/create", "/create/app", "/profile", "/admin"] as const;
const SESSION_EXPIRED_REASON = "session-expired";
const SESSION_EXPIRED_MESSAGE = "Session expired, please log in again.";

function getValidatedRedirectTarget(
  redirectParam: string | null,
): (typeof ALLOWED_REDIRECTS)[number] {
  const isAllowed = (p: string | null): p is (typeof ALLOWED_REDIRECTS)[number] =>
    !!p && ALLOWED_REDIRECTS.includes(p as (typeof ALLOWED_REDIRECTS)[number]);
  return isAllowed(redirectParam) ? redirectParam : "/create";
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, login } = useAuth();
  const isSessionExpired = searchParams.get("reason") === SESSION_EXPIRED_REASON;
  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (state.isSsoOnly) {
      form.setValue("password", "");
    }
  }, [state.isSsoOnly, form]);

  async function onSubmit(values: SignInFormValues) {
    startTransition(() => {
      login(values.email, values.password).then((ok) => {
        if (ok) {
          const redirectParam = searchParams.get("redirect");
          const target = getValidatedRedirectTarget(redirectParam);
          router.push(target);
          toast.success("Signed in successfully");
        } else {
          toast.error("Failed to sign in");
        }
      });
    });
  }

  function handleSsoSignIn() {
    const redirectParam = searchParams.get("redirect");
    const target = getValidatedRedirectTarget(redirectParam);
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    window.location.href = `${apiBaseUrl}/auth/saml/login?redirect=${encodeURIComponent(target)}`;
  }

  return (
    <form className="space-y-5" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      {isSessionExpired ? (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-3">
          <p className="text-xs font-medium text-amber-300" role="status">
            {SESSION_EXPIRED_MESSAGE}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-muted-foreground">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          className="bg-input/50 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-0 rounded-xl h-11"
          {...form.register("email")}
          aria-invalid={!!form.formState.errors.email}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-destructive mt-1">{form.formState.errors.email.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-muted-foreground">
          Password
        </Label>
        <PasswordInput
          id="password"
          placeholder="••••••••"
          className="bg-input/50 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-0 rounded-xl h-11"
          {...form.register("password")}
          aria-invalid={!!form.formState.errors.password}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-destructive mt-1">{form.formState.errors.password.message}</p>
        ) : null}
      </div>
      {state.isSsoOnly ? (
        <div className="space-y-4 pt-2">
          <div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
            <p className="text-xs text-accent font-medium" role="alert">
              Your account uses Single Sign-On (SSO). Please sign in through your
              organization&apos;s identity provider.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-full border-border text-foreground hover:bg-muted/50 font-medium transition-all"
            onClick={handleSsoSignIn}
            disabled={state.loading}
          >
            Sign in with SSO
          </Button>
        </div>
      ) : null}

      {!state.isSsoOnly && state.error ? (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-xs text-destructive font-medium" role="alert">
            {state.error}
          </p>
        </div>
      ) : null}

      {!state.isSsoOnly && (
        <div className="space-y-3">
          <Button
            type="submit"
            className="w-full h-11 rounded-full bg-foreground !text-background hover:bg-foreground/85 font-medium transition-all shadow-lg"
            disabled={state.loading}
          >
            {state.loading ? "Signing in…" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 rounded-full border-border text-foreground hover:bg-muted/50 font-medium transition-all"
            onClick={handleSsoSignIn}
            disabled={state.loading}
          >
            Sign in with SSO
          </Button>
        </div>
      )}
    </form>
  );
}
