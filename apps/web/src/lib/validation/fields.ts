import { z } from "zod";

/** Matches emoji / pictographs and regional-indicator symbols (e.g. flag pairs). */
const EMOJI_OR_PICTOGRAPH = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** Display name: trim, length, no emoji (profile / signup / invite). */
export const userDisplayNameField = z
  .string()
  .trim()
  .min(3, "Name must be at least 3 characters")
  .max(40, "Name must be 40 characters or less")
  .refine((s: string) => !EMOJI_OR_PICTOGRAPH.test(s), {
    message: "Name cannot contain emoji or regional-indicator symbols",
  });

/** Sign-up / auth password rules. */
export const strongPasswordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character");

/**
 * Email: trim, validate format, normalize to lowercase (Zod 4 check chain).
 */
export const userEmailField = z
  .string()
  .check(z.trim(), z.email("Enter a valid email"), z.toLowerCase());
