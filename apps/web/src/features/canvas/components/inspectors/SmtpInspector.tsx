import type { Node } from "@xyflow/react";
import type { SmtpData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { CredentialSelector } from "@/components/shared/CredentialSelector";
import type { CredentialRef } from "@/lib/credentials";
import { VariableInput } from "../variable-picker/VariableInput";
import { VariableTextarea } from "../variable-picker/VariableTextarea";
import { LEGACY_SMTP_PLACEHOLDER_VALUES } from "@/lib/workflow-dsl";

type SmtpInspectorProps = {
  node: Node<SmtpData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

function editableSmtpValue(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed || LEGACY_SMTP_PLACEHOLDER_VALUES.has(trimmed)) return "";
  return value ?? "";
}

export function SmtpInspector({ node, updateData, isExpanded }: SmtpInspectorProps) {
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
      <VariableInput
        value={editableSmtpValue(node.data.from)}
        onChange={(v) =>
          updateSmtpData((d) => ({
            ...d,
            from: v,
          }))
        }
        placeholder="sender@example.com"
        nodeId={node.id}
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">Email address of the sender</div>
      )}

      <label className="block text-xs text-muted-foreground">To</label>
      <VariableInput
        value={editableSmtpValue(node.data.to)}
        onChange={(v) =>
          updateSmtpData((d) => ({
            ...d,
            to: v,
          }))
        }
        placeholder="recipient@example.com"
        nodeId={node.id}
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">
          Email address of the recipient (comma-separated for multiple)
        </div>
      )}

      <label className="block text-xs text-muted-foreground">CC</label>
      <VariableInput
        value={editableSmtpValue(node.data.cc)}
        onChange={(v) =>
          updateSmtpData((d) => ({
            ...d,
            cc: v,
          }))
        }
        placeholder="cc@example.com"
        nodeId={node.id}
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">
          Carbon copy recipients (comma-separated for multiple)
        </div>
      )}

      <label className="block text-xs text-muted-foreground">BCC</label>
      <VariableInput
        value={editableSmtpValue(node.data.bcc)}
        onChange={(v) =>
          updateSmtpData((d) => ({
            ...d,
            bcc: v,
          }))
        }
        placeholder="bcc@example.com"
        nodeId={node.id}
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">
          Blind carbon copy recipients (comma-separated for multiple)
        </div>
      )}

      <label className="block text-xs text-muted-foreground">Subject</label>
      <VariableInput
        value={editableSmtpValue(node.data.subject)}
        onChange={(v) =>
          updateSmtpData((d) => ({
            ...d,
            subject: v,
          }))
        }
        placeholder="Email subject line"
        nodeId={node.id}
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">Subject line for the email message</div>
      )}

      <label className="block text-xs text-muted-foreground">Body</label>
      <VariableTextarea
        value={editableSmtpValue(node.data.body)}
        onChange={(v) =>
          updateSmtpData((d) => ({
            ...d,
            body: v,
          }))
        }
        placeholder="Email message body"
        nodeId={node.id}
      />
      {isExpanded && (
        <div className="text-xs text-muted-foreground/70">The content of the email message</div>
      )}
    </div>
  );
}
