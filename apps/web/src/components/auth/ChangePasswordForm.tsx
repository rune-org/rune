"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { changeMyPassword } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth";

const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        "Password must contain at least one special character"
      ),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const router = useRouter();
  const { refetchProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ChangePasswordFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: apiError } = await changeMyPassword(
        values.oldPassword,
        values.newPassword
      );

      if (apiError || !data) {
        const errorMessage = getErrorMessage(apiError);
        setError(errorMessage);
        setIsSubmitting(false);
        return;
      }

      toast.success("Password changed successfully!");

      // Refetch the user profile to get the updated must_change_password flag
      await refetchProfile();

      router.push("/create");
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-2">
        <Label htmlFor="oldPassword" className="text-zinc-400">
          Current Password
        </Label>
        <Input
          id="oldPassword"
          type="password"
          placeholder="Enter your current password"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          {...form.register("oldPassword")}
          aria-invalid={!!form.formState.errors.oldPassword}
        />
        {form.formState.errors.oldPassword ? (
          <p className="text-xs text-red-400 mt-1">
            {form.formState.errors.oldPassword.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword" className="text-zinc-400">
          New Password
        </Label>
        <Input
          id="newPassword"
          type="password"
          placeholder="Create a secure password"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          {...form.register("newPassword")}
          aria-invalid={!!form.formState.errors.newPassword}
        />
        {form.formState.errors.newPassword ? (
          <p className="text-xs text-red-400 mt-1">
            {form.formState.errors.newPassword.message}
          </p>
        ) : (
          <p className="text-xs text-zinc-500 mt-1">
            8+ characters, uppercase, lowercase, number, and special character
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-zinc-400">
          Confirm New Password
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm your new password"
          className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          {...form.register("confirmPassword")}
          aria-invalid={!!form.formState.errors.confirmPassword}
        />
        {form.formState.errors.confirmPassword ? (
          <p className="text-xs text-red-400 mt-1">
            {form.formState.errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-xs text-red-400 font-medium" role="alert">
            {error}
          </p>
        </div>
      ) : null}

      <Button
        type="submit"
        className="w-full h-11 rounded-full bg-white !text-black hover:bg-zinc-200 font-medium transition-all shadow-lg mt-2"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Changing password..." : "Change password"}
      </Button>
    </form>
  );
}

function getErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.detail === "string") return e.detail;
    if (typeof e.message === "string") return e.message;
  }
  return "Failed to change password. Please try again.";
}
