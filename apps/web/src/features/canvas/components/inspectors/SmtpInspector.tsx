import type { Node } from "@xyflow/react";
import type { SmtpData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { CredentialSelector } from "@/components/shared/CredentialSelector";
import type { CredentialRef } from "@/lib/credentials";
import { Textarea } from "@/components/ui/textarea";

type SmtpInspectorProps = {
  node: Node<SmtpData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function SmtpInspector({
  node,
  updateData,
  isExpanded,
}: SmtpInspectorProps) {
  const updateSmtpData = (updater: (data: SmtpData) => SmtpData) => {
    updateData(node.id, "smtp", updater);
  };

  const handleCredentialChange = (credential: CredentialRef | null) => {
    updateSmtpData((d) => ({
      ...d,
      credential,
    }));
  };

  return (
    <div className="space-y-2">
      <CredentialSelector
        credentialType="smtp"
        value={node.data.credential}
        onChange={handleCredentialChange}
        label="SMTP Credential"
        placeholder="Select SMTP credential"
        showHelp={isExpanded}
      />
      
      <label className="block text-xs text-muted-foreground">From</label>
      <input
        className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
        value={node.data.from ?? ""}
        onChange={(e) =>
          updateSmtpData((d) => ({
            ...d,
            from: e.target.value,
          }))
        }
        placeholder="sender@example.com"
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">
          Email address of the sender
        </div>
      )}

      <label className="block text-xs text-muted-foreground">To</label>
      <input
        className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
        value={node.data.to ?? ""}
        onChange={(e) =>
          updateSmtpData((d) => ({
            ...d,
            to: e.target.value,
          }))
        }
        placeholder="recipient@example.com"
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">
          Email address of the recipient (comma-separated for multiple)
        </div>
      )}

      <label className="block text-xs text-muted-foreground">CC</label>
      <input
        className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
        value={node.data.cc ?? ""}
        onChange={(e) =>
          updateSmtpData((d) => ({
            ...d,
            cc: e.target.value,
          }))
        }
        placeholder="cc@example.com"
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">
          Carbon copy recipients (comma-separated for multiple)
        </div>
      )}

      <label className="block text-xs text-muted-foreground">BCC</label>
      <input
        className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
        value={node.data.bcc ?? ""}
        onChange={(e) =>
          updateSmtpData((d) => ({
            ...d,
            bcc: e.target.value,
          }))
        }
        placeholder="bcc@example.com"
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">
          Blind carbon copy recipients (comma-separated for multiple)
        </div>
      )}

      <label className="block text-xs text-muted-foreground">Subject</label>
      <input
        className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
        value={node.data.subject ?? ""}
        onChange={(e) =>
          updateSmtpData((d) => ({
            ...d,
            subject: e.target.value,
          }))
        }
        placeholder="Email subject line"
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">
          Subject line for the email message
        </div>
      )}

      <label className="block text-xs text-muted-foreground">Body</label>
      <Textarea
        className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
        value={node.data.body ?? ""}
        onChange={(e) =>
          updateSmtpData((d) => ({
            ...d,
            body: e.target.value,
          }))
        }
        placeholder="Email message body"
        rows={isExpanded ? 6 : 3}
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">
          The content of the email message
        </div>
      )}
    </div>
  );
}
