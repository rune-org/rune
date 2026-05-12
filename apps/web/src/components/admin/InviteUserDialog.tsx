"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { inviteUserSchema, type InviteUserFormValues } from "@/lib/validation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const onSubmit = async (values: InviteUserFormValues) => {
    setIsSubmitting(true);
    try {
      const success = await onInvite(values.name, values.email, values.role);
      if (success) {
        form.reset({ name: "", email: "", role: "user" });
        toast.success("User invited successfully");
      }
    } catch (_error) {
      toast.error("Failed to invite user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset({ name: "", email: "", role: "user" });
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
        className="max-w-md gap-4 sm:max-w-md"
        onEscapeKeyDown={preventCloseWhileSubmitting}
        onPointerDownOutside={preventCloseWhileSubmitting}
        onInteractOutside={preventCloseWhileSubmitting}
      >
        <DialogHeader className="gap-2 text-left">
          <DialogTitle className="text-lg">Invite User</DialogTitle>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
