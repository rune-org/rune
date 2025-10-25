import type { Node } from "@xyflow/react";
import type { SmtpData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";

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

  return (
    <div className="space-y-2">
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
          Email address of the recipient
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
    </div>
  );
}
