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
      // Redirect to /create - RequireAuth will handle redirecting to
      // /change-password if the user needs to change their password
      const redirectParam = searchParams.get("redirect");
      const allowed = ["/create", "/create/app", "/profile", "/settings", "/admin"] as const;
      const isAllowed = (p: string | null): p is (typeof allowed)[number] => !!p && allowed.includes(p as (typeof allowed)[number]);
      const target = isAllowed(redirectParam) ? redirectParam : "/create";
      router.push(target);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-zinc-400">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          {...register("email")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-zinc-400">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          {...register("password")}
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
        disabled={state.loading}
      >
        {state.loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}