"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, login } = useAuth();
  const { register, handleSubmit } = useForm<{
    email: string;
    password: string;
  }>();

  async function onSubmit(values: { email: string; password: string }) {
    const ok = await login(values.email, values.password);
    if (ok) {
      const redirectParam = searchParams.get("redirect");
      const target = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/create";
      router.push(target);
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          {...register("email")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          {...register("password")}
        />
      </div>
      {state.error ? (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={state.loading}>
        {state.loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
