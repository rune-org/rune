"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { inviteUserSchema, type InviteUserFormValues } from "@/lib/validation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserResponse } from "@/client/types.gen";

interface EditUserDialogProps {
  open: boolean;
  onClose: () => void;
  user: UserResponse | null;
  onUpdate: (name: string, email: string, role: "user" | "admin") => Promise<boolean>;
}

/**
 * Both invite and edit user schemas are the same,
 * This is done for readability.
 */
const editUserSchema = inviteUserSchema;
type EditUserFormValues = InviteUserFormValues;

/** Same fields/rules as invite (`inviteUserSchema`). */
function roleFromUser(user: UserResponse): "user" | "admin" {
  return user.role;
}

export function EditUserDialog({ open, onClose, user, onUpdate }: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: user?.role ?? "user",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (open && user) {
      form.reset({
        name: user.name ?? "",
        email: user.email ?? "",
        role: user.role ?? "user",
      });
      void form.trigger();
    }
  }, [open, user, form]);

  if (!user) return null;

  const onSubmit = async (values: EditUserFormValues) => {
    setIsSubmitting(true);
    try {
      await onUpdate(values.name, values.email, values.role);
    } catch (error) {
      console.error("Failed to update user:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset({
      name: user.name ?? "",
      email: user.email ?? "",
      role: roleFromUser(user),
    });
    onClose();
  };

  const { isValid } = form.formState;

  const preventCloseWhileSubmitting = (e: Event) => {
    if (isSubmitting) e.preventDefault();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) {
          handleClose();
        }
      }}
    >
      <DialogContent
        hideCloseButton
        className="max-w-md gap-4"
        onEscapeKeyDown={preventCloseWhileSubmitting}
        onPointerDownOutside={preventCloseWhileSubmitting}
        onInteractOutside={preventCloseWhileSubmitting}
      >
        <DialogHeader className="gap-2 text-left">
          <DialogTitle className="text-lg">Edit User</DialogTitle>
        </DialogHeader>

        <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              type="text"
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm mt-1"
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              type="email"
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm mt-1"
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Role</Label>
            <select
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm mt-1"
              aria-invalid={!!form.formState.errors.role}
              {...form.register("role")}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            {form.formState.errors.role ? (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.role.message}</p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary text-white"
              disabled={isSubmitting || !isValid}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
