"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { updateMyProfile } from "@/lib/api/users";
import type { UserResponse } from "@/client/types.gen";
import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

// Zod schemas for validation
const nameSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
});

const emailSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
});

type EditingField = "name" | "email" | null;

export default function ProfilePage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [dialogResetKey, setDialogResetKey] = useState(0);
  const { state, logout } = useAuth();

  const user = state.user as UserResponse | null;
  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : "User";

  useEffect(() => {
    if (user) {
      setFullName(user.name ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);

  /**
   * Returns the initials of a given name.
   * - If the name is empty or does not contain any valid characters, returns "U".
   * - For names with multiple words, takes the first character of each word, joins them, and returns the first two uppercase letters.
   * - Special characters and whitespace are included as initials if present in the name.
   * @param name The full name string.
   * @returns The initials (up to 2 uppercase letters), or "U" if not available.
   */
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  const handleSaveName = async () => {
    // Validate with zod
    const result = nameSchema.safeParse({ name: fullName });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsSaving(true);
    setError(null);

    const { error: apiError } = await updateMyProfile({
      name: result.data.name,
    });

    if (apiError) {
      setError(getErrorMessage(apiError));
      setIsSaving(false);
      return;
    }

    // Log out user after successful update
    await logout();
  };

  const handleSaveEmail = async () => {
    // Validate with zod
    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsSaving(true);
    setError(null);

    const { error: apiError } = await updateMyProfile({
      email: result.data.email,
    });

    if (apiError) {
      setError(getErrorMessage(apiError));
      setIsSaving(false);
      return;
    }

    // Log out user after successful update
    await logout();
  };

  const handleCancelName = () => {
    setFullName(user?.name ?? "");
    setEditingField(null);
    setError(null);
  };

  const handleCancelEmail = () => {
    setEmail(user?.email ?? "");
    setEditingField(null);
    setError(null);
  };

  const handlePasswordDialogChange = (open: boolean) => {
    setIsPasswordDialogOpen(open);
    if (!open) {
      // Increment reset key to trigger form reset
      setDialogResetKey((k) => k + 1);
    }
  };

  const handlePasswordChangeSuccess = async () => {
    setIsPasswordDialogOpen(false);
    // Log out user after password change
    await logout();
  };

  return (
    <Container className="py-8 md:py-12" widthClassName="max-w-2xl">
      <div className="space-y-8">
        <PageHeader
          title="Profile"
          description="Manage your account settings"
        />

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
                  {getInitials(fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle>{fullName || "—"}</CardTitle>
                <CardDescription>{email || "—"}</CardDescription>
                <Badge variant="secondary" className="mt-1">
                  {roleLabel}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <Separator />

          {/* Personal Info Section */}
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              Personal Information
            </h3>

            {error && (
              <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Full Name Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fullName">Full Name</Label>
                  {editingField !== "name" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingField("name");
                        setError(null);
                      }}
                      disabled={editingField !== null}
                    >
                      Edit
                    </Button>
                  )}
                </div>
                {editingField === "name" ? (
                  <div className="space-y-3">
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoFocus
                      disabled={isSaving}
                    />
                    <p className="text-xs text-amber-500">
                      Note: You will be logged out after updating your name.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveName}
                        disabled={isSaving}
                        size="sm"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelName}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm">{fullName || "—"}</p>
                )}
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="email">Email Address</Label>
                  {editingField !== "email" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingField("email");
                        setError(null);
                      }}
                      disabled={editingField !== null}
                    >
                      Edit
                    </Button>
                  )}
                </div>
                {editingField === "email" ? (
                  <div className="space-y-3">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                      disabled={isSaving}
                    />
                    <p className="text-xs text-amber-500">
                      Note: You will be logged out after updating your email.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveEmail}
                        disabled={isSaving}
                        size="sm"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEmail}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm">{email || "—"}</p>
                )}
              </div>
            </div>
          </CardContent>

          <Separator />

          {/* Security Section */}
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">
              Security
            </h3>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPasswordDialogOpen(true)}
              >
                Change Password
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logout()}
                disabled={state.loading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {state.loading ? "Logging out…" : "Log out"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Change Password Dialog */}
      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={handlePasswordDialogChange}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one. You will be
              logged out after changing your password.
            </DialogDescription>
          </DialogHeader>
          <ChangePasswordForm
            variant="dialog"
            resetKey={dialogResetKey}
            onSuccess={handlePasswordChangeSuccess}
            onCancel={() => setIsPasswordDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Container>
  );
}
function getErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.detail === "string") return e.detail;
    if (typeof e.message === "string") return e.message;
  }
  return "Failed to update profile. Please try again.";
}
