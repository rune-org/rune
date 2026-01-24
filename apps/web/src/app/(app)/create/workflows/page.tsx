"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Container } from "@/components/shared/Container";
import { WorkflowsTable } from "@/components/workflows/WorkflowsTable";
import { toast } from "@/components/ui/toast";
import { workflows } from "@/lib/api";
import { defaultWorkflowSummary } from "@/lib/workflows";
import { useAppState } from "@/lib/state";

export default function CreateWorkflowsPage() {
  const { actions } = useAppState();

  useEffect(() => {
    void actions.init();
  }, []);

  return (
    <Container className="flex flex-col gap-8 py-12" widthClassName="max-w-6xl">
      <PageHeader title="Your Workflows" actions={<CreateWorkflowButton />} />
      <WorkflowsTable />
    </Container>
  );
}

function CreateWorkflowButton() {
  const router = useRouter();
  const {
    actions: { refreshWorkflows },
  } = useAppState();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      const response = await workflows.createWorkflow({
        name: name.trim() || defaultWorkflowSummary.name,
        description: description.trim() || "",
        workflow_data: {
          nodes: [],
          edges: [],
        },
      });

      if (!response.data) {
        throw new Error("Create workflow response was empty");
      }

      const created = response.data.data;
      toast.success("Workflow created. Redirecting to canvas…");
      setOpen(false);
      setName("");
      setDescription("");
      void refreshWorkflows();
      router.push(`/create/app?workflow=${created.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create workflow. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) {
          setOpen(next);
          if (!next) {
            setName("");
            setDescription("");
          }
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>Create Workflow</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a workflow</DialogTitle>
          <DialogDescription>
            Give your workflow a name and optional description. You can design
            the graph after creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="workflow-name">Name</Label>
            <Input
              id="workflow-name"
              placeholder="Customer onboarding"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="workflow-description">Description</Label>
            <Textarea
              id="workflow-description"
              placeholder="Briefly describe what this workflow should accomplish."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
        <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? "Creating…" : "Create & open canvas"}
            </Button>
          </DialogFooter>
        </form>
        <p className="text-xs text-muted-foreground">
          Need to import an existing workflow? You can paste workflow JSON
          directly inside the canvas later.
        </p>
      </DialogContent>
    </Dialog>
  );
}
