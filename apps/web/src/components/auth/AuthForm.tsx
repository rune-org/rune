"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { signUpSchema, type SignUpFormValues } from "@/lib/validation";

export function AuthForm() {
  const [isPending, startTransition] = useTransition();
  const { state, signUp } = useAuth();

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  function onSubmit(values: SignUpFormValues) {
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
    <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="name" className="text-muted-foreground">
          Name
        </Label>
        <Input
          id="name"
          placeholder="Jane Doe"
          className="bg-input/50 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-0 rounded-xl h-11"
          {...form.register("name")}
          aria-invalid={!!form.formState.errors.name}
        />
        {form.formState.errors.name ? (
          <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">3-40 characters</p>
        )}
      </div>
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
          placeholder="Create a secure password"
          className="bg-input/50 border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-0 rounded-xl h-11"
          {...form.register("password")}
          aria-invalid={!!form.formState.errors.password}
        />
        {form.formState.errors.password ? (
          <p className="text-xs text-destructive mt-1">{form.formState.errors.password.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            8+ characters, uppercase, lowercase, number, and special character
          </p>
        )}
      </div>
      {state.error ? (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-xs text-destructive font-medium" role="alert">
            {state.error}
          </p>
        </div>
      ) : null}

      <Button
        type="submit"
        className="w-full h-11 rounded-full bg-foreground !text-background hover:bg-foreground/85 font-medium transition-all shadow-lg mt-2"
        disabled={isPending || state.loading}
      >
        {isPending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
