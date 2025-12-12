"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";

const signUpSchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters long")
    .max(40, "Name must be 40 characters or less"),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      "Password must contain at least one special character"
    ),
});

type SignUpForm = z.infer<typeof signUpSchema>;

export function AuthForm() {
  const [isPending, startTransition] = useTransition();
  const { state, signUp } = useAuth();

  const form = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  function onSubmit(values: SignUpForm) {
    startTransition(() => {
      signUp(values.name, values.email, values.password)
        .then((ok) => {
          if (ok) {
            toast.success(`Welcome to Rune, ${values.name}!`);
            form.reset();
          }
        })
        .catch(() => {
          // error handled via state.error below
        });
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="name" className="text-zinc-400">Name</Label>
        <Input
          id="name"
          placeholder="Jane Doe"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          {...form.register("name")}
          aria-invalid={!!form.formState.errors.name}
        />
        {form.formState.errors.name ? (
          <p className="text-xs text-red-400 mt-1">
            {form.formState.errors.name.message}
          </p>
        ) : (
          <p className="text-xs text-zinc-500 mt-1">3-40 characters</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="text-zinc-400">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          {...form.register("email")}
          aria-invalid={!!form.formState.errors.email}
        />
        {form.formState.errors.email ? (
          <p className="text-xs text-red-400 mt-1">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-zinc-400">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Create a secure password"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          {...form.register("password")}
          aria-invalid={!!form.formState.errors.password}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-red-400 mt-1">
            {form.formState.errors.password.message}
          </p>
        ) : (
          <p className="text-xs text-zinc-500 mt-1">
            8+ characters, uppercase, lowercase, number, and special character
          </p>
        )}
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
        className="w-full h-11 rounded-full bg-white !text-black hover:bg-zinc-200 font-medium transition-all shadow-lg mt-2"
        disabled={isPending || state.loading}
      >
        {isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}