"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toast";
import { changeMyPassword } from "@/lib/api/auth";
import { cn } from "@/lib/cn";

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

export interface ChangePasswordFormProps {
  /**
   * Callback called after successful password change.
   * Use this to handle navigation or logout.
   */
  onSuccess?: () => void | Promise<void>;
  /**
   * Optional callback when cancel button is clicked.
   * If provided, a cancel button will be shown.
   */
  onCancel?: () => void;
  /**
   * Variant controls the styling of the form.
   * - "page": Styled for full-page usage (AuthCard)
   * - "dialog": Styled for dialog/modal usage
   */
  variant?: "page" | "dialog";
  /**
   * Whether to reset the form when it mounts or when a key prop changes.
   * Useful for dialog usage where form should reset on close/open.
   */
  resetKey?: string | number;
}

export function ChangePasswordForm({
  onSuccess,
  onCancel,
  variant = "page",
  resetKey,
}: ChangePasswordFormProps) {
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

  // Reset form when resetKey changes (useful for dialogs)
  useEffect(() => {
    if (resetKey !== undefined) {
      form.reset();
      setError(null);
    }
  }, [resetKey, form]);

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

      if (onSuccess) {
        await onSuccess();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsSubmitting(false);
    }
  }

  const isDialog = variant === "dialog";

  return (
    <form
      className={cn("space-y-5", isDialog && "space-y-4")}
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-2">
        <Label
          htmlFor="oldPassword"
          className={cn(!isDialog && "text-zinc-400")}
        >
          Current Password
        </Label>
        <PasswordInput
          id="oldPassword"
          placeholder="Enter your current password"
          className={cn(
            !isDialog &&
              "bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          )}
          {...form.register("oldPassword")}
          aria-invalid={!!form.formState.errors.oldPassword}
        />
        {form.formState.errors.oldPassword ? (
          <p className={cn("text-xs mt-1", isDialog ? "text-destructive" : "text-red-400")}>
            {form.formState.errors.oldPassword.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="newPassword"
          className={cn(!isDialog && "text-zinc-400")}
        >
          New Password
        </Label>
        <PasswordInput
          id="newPassword"
          placeholder="Create a secure password"
          className={cn(
            !isDialog &&
              "bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          )}
          {...form.register("newPassword")}
          aria-invalid={!!form.formState.errors.newPassword}
        />
        {form.formState.errors.newPassword ? (
          <p className={cn("text-xs mt-1", isDialog ? "text-destructive" : "text-red-400")}>
            {form.formState.errors.newPassword.message}
          </p>
        ) : (
          <p className={cn("text-xs mt-1", isDialog ? "text-muted-foreground" : "text-zinc-500")}>
            8+ characters, uppercase, lowercase, number, and special character
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="confirmPassword"
          className={cn(!isDialog && "text-zinc-400")}
        >
          Confirm New Password
        </Label>
        <PasswordInput
          id="confirmPassword"
          placeholder="Confirm your new password"
          className={cn(
            !isDialog &&
              "bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-white/20 focus:ring-0 rounded-xl h-11"
          )}
          {...form.register("confirmPassword")}
          aria-invalid={!!form.formState.errors.confirmPassword}
        />
        {form.formState.errors.confirmPassword ? (
          <p className={cn("text-xs mt-1", isDialog ? "text-destructive" : "text-red-400")}>
            {form.formState.errors.confirmPassword.message}
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          className={cn(
            "rounded-lg p-3",
            isDialog
              ? "bg-destructive/10 text-destructive text-sm"
              : "bg-red-500/10 border border-red-500/20"
          )}
        >
          <p
            className={cn(
              "font-medium",
              isDialog ? "" : "text-xs text-red-400"
            )}
            role="alert"
          >
            {error}
          </p>
        </div>
      ) : null}

      {isDialog ? (
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Changing..." : "Change Password"}
          </Button>
        </div>
      ) : (
        <Button
          type="submit"
          className="w-full h-11 rounded-full bg-white !text-black hover:bg-zinc-200 font-medium transition-all shadow-lg mt-2"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Changing password..." : "Change password"}
        </Button>
      )}
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
