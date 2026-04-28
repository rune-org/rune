"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { inviteUserSchema, type InviteUserFormValues } from "@/lib/validation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onInvite: (name: string, email: string, role: "user" | "admin") => Promise<boolean>;
}

export function InviteUserDialog({ open, onClose, onInvite }: InviteUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "user",
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: "", email: "", role: "user" });
    }
  }, [open, form]);

  if (!open) return null;

  const onSubmit = async (values: InviteUserFormValues) => {
    setIsSubmitting(true);
    try {
      const success = await onInvite(values.name, values.email, values.role);
      if (success) {
        form.reset({ name: "", email: "", role: "user" });
        toast.success("User invited successfully");
      }
    } catch (error) {
      toast.error("Failed to invite user")
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset({ name: "", email: "", role: "user" });
    onClose();
  };

  const handleBackdropClick = (_e: React.MouseEvent<HTMLDivElement>) => {
    if (isSubmitting) return;
    handleClose();
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const { isValid } = form.formState;

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/60 flex items-center justify-center p-6 z-40"
      onClick={handleBackdropClick}
    >
      <Card className="p-6 w-full max-w-md bg-background border" onClick={handleCardClick}>
        <h3 className="text-lg font-semibold mb-4">Invite User</h3>

        <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div>
            <Input
              type="text"
              placeholder="Full Name"
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm"
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div>
            <Input
              type="email"
              placeholder="User email"
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm"
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive mt-1">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <Label className="block text-sm font-medium mb-1">Role</Label>
            <select
              className="w-full px-3 py-2 rounded-md bg-muted border text-sm"
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
              {isSubmitting ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
