import { z } from "zod";

import { strongPasswordField, userDisplayNameField, userEmailField } from "./fields";

export const signUpSchema = z.object({
  name: userDisplayNameField,
  email: userEmailField,
  password: strongPasswordField,
});

export const signInSchema = z.object({
  email: userEmailField,
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: strongPasswordField,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const profileNameSchema = z.object({
  name: userDisplayNameField,
});

export const profileEmailSchema = z.object({
  email: userEmailField,
});

export const inviteUserSchema = z.object({
  name: userDisplayNameField,
  email: userEmailField,
  role: z.enum(["admin", "user"]),
});

export type SignUpFormValues = z.infer<typeof signUpSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type InviteUserFormValues = z.infer<typeof inviteUserSchema>;
export type SignInFormValues = z.infer<typeof signInSchema>;
