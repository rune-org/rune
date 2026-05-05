import type { Node } from "@xyflow/react";
import { Copy } from "lucide-react";
import type { WebhookTriggerData } from "../../types";
import { toast } from "@/components/ui/toast";

type WebhookTriggerInspectorProps = {
  node: Node<WebhookTriggerData>;
  isExpanded: boolean;
};

export function WebhookTriggerInspector({ node, isExpanded }: WebhookTriggerInspectorProps) {
  const webhookGuid = node.data.webhookGuid ?? "";
  const webhookUrl = webhookGuid ? getWebhookUrl(webhookGuid) : "";
  const hasWebhookUrl = webhookUrl.length > 0;

  const handleCopy = async () => {
    if (!hasWebhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook URL copied");
    } catch {
      toast.error("Failed to copy webhook URL");
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-muted-foreground">Webhook URL</label>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm text-muted-foreground"
            value={webhookUrl}
            placeholder="Unavailable"
            readOnly
          />
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            title="Copy webhook URL"
            aria-label="Copy webhook URL"
            disabled={!hasWebhookUrl}
            onClick={handleCopy}
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          External systems can POST JSON to this URL after the workflow version is published and
          active.
        </div>
      )}
    </div>
  );
}

function getWebhookUrl(guid: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const path = `/webhook/${guid}`;

  if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
    return `${baseUrl.replace(/\/$/, "")}${path}`;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${baseUrl.replace(/\/$/, "")}${path}`;
}
