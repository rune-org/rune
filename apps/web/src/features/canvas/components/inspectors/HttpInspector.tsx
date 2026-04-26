import type { Node } from "@xyflow/react";
import { HTTP_METHODS, isHttpMethod, type HttpData } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { JsonField } from "../JsonField";
import { KeyValueVariableEditor } from "../KeyValueVariableEditor";
import { VariableInput } from "../variable-picker/VariableInput";
import { CredentialSelector } from "@/components/shared/CredentialSelector";
import type { CredentialRef } from "@/lib/credentials";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HTTP_CREDENTIAL_TYPES: ("basic_auth" | "header" | "api_key" | "oauth2" | "token")[] = [
  "basic_auth",
  "header",
  "api_key",
  "oauth2",
  "token",
];

type HttpInspectorProps = {
  node: Node<HttpData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function HttpInspector({ node, updateData, isExpanded }: HttpInspectorProps) {
  const updateHttpData = (updater: (data: HttpData) => HttpData) => {
    updateData(node.id, "http", updater);
  };

  const handleCredentialChange = (credential: CredentialRef | null) => {
    updateHttpData((d) => ({
      ...d,
      credential,
    }));
  };

  return (
    <div className="space-y-3">
      <CredentialSelector
        credentialType={HTTP_CREDENTIAL_TYPES}
        value={node.data.credential}
        onChange={handleCredentialChange}
        label="Authentication"
        placeholder="Select authentication"
        showHelp={isExpanded}
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted-foreground">Method</label>
          <Select
            value={node.data.method ?? "GET"}
            onValueChange={(value) => {
              if (!isHttpMethod(value)) return;
              updateHttpData((d) => ({
                ...d,
                method: value,
              }));
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Timeout (s)</label>
          <input
            type="number"
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
            value={node.data.timeout ?? 30}
            onChange={(e) =>
              updateHttpData((d) => ({
                ...d,
                timeout: Number(e.target.value),
              }))
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground">URL</label>
        <VariableInput
          value={node.data.url ?? ""}
          onChange={(v) =>
            updateHttpData((d) => ({
              ...d,
              url: v,
            }))
          }
          placeholder="https://api.example.com/path"
          nodeId={node.id}
        />
        {isExpanded && (
          <div className="text-xs text-muted-foreground/70">
            The URL endpoint for the HTTP request
          </div>
        )}
      </div>
      <details
        className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2"
        open={isExpanded}
      >
        <summary className="cursor-pointer text-xs text-muted-foreground">Headers</summary>
        <KeyValueVariableEditor
          value={node.data.headers}
          onChange={(obj) =>
            updateHttpData((d) => ({
              ...d,
              headers: obj,
            }))
          }
          nodeId={node.id}
          keyPlaceholder="Header name"
          valuePlaceholder="Header value"
          addLabel="Add header"
          emptyLabel="No headers defined."
        />
        {isExpanded && (
          <div className="mt-1 text-xs text-muted-foreground/70">
            Custom HTTP headers to include in the request
          </div>
        )}
      </details>
      <details
        className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2"
        open={isExpanded}
      >
        <summary className="cursor-pointer text-xs text-muted-foreground">Query Params</summary>
        <KeyValueVariableEditor
          value={node.data.query}
          onChange={(obj) =>
            updateHttpData((d) => ({
              ...d,
              query: obj,
            }))
          }
          nodeId={node.id}
          keyPlaceholder="Param name"
          valuePlaceholder="Param value"
          addLabel="Add param"
          emptyLabel="No query params defined."
        />
        {isExpanded && (
          <div className="mt-1 text-xs text-muted-foreground/70">
            URL query parameters to append to the request
          </div>
        )}
      </details>
      <details
        className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2"
        open={isExpanded}
      >
        <summary className="cursor-pointer text-xs text-muted-foreground">Body (JSON)</summary>
        <JsonField
          value={node.data.body}
          onChange={(obj) =>
            updateHttpData((d) => ({
              ...d,
              body: obj,
            }))
          }
        />
        {isExpanded && (
          <div className="mt-1 text-xs text-muted-foreground/70">
            Request body payload (typically for POST/PUT/PATCH)
          </div>
        )}
      </details>
      <details
        className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2"
        open={isExpanded}
      >
        <summary className="cursor-pointer text-xs text-muted-foreground">Advanced</summary>
        <div className="mt-2 space-y-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={node.data.ignore_ssl ?? false}
              onChange={(e) =>
                updateHttpData((d) => ({
                  ...d,
                  ignore_ssl: e.target.checked,
                }))
              }
            />
            Ignore SSL
          </label>
          {isExpanded && (
            <div className="text-xs text-muted-foreground/70">
              Skip SSL certificate validation (use with caution)
            </div>
          )}
          <label className="block">Retries</label>
          <input
            type="number"
            min={0}
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1"
            value={node.data.retry ?? 0}
            onChange={(e) =>
              updateHttpData((d) => ({
                ...d,
                retry: Number(e.target.value),
              }))
            }
          />
          {isExpanded && (
            <div className="text-xs text-muted-foreground/70">
              Number of retry attempts after transport errors or raise-on-status matches
            </div>
          )}
          <label className="block">Retry delay (s)</label>
          <input
            type="number"
            min={0}
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1"
            value={node.data.retry_delay ?? 0}
            onChange={(e) =>
              updateHttpData((d) => ({
                ...d,
                retry_delay: Number(e.target.value),
              }))
            }
          />
          {isExpanded && (
            <div className="text-xs text-muted-foreground/70">
              Seconds to wait between retry attempts
            </div>
          )}
          <label className="block">Raise on status</label>
          <input
            type="text"
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 font-mono text-[11px]"
            value={node.data.raise_on_status ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              updateHttpData((d) => ({
                ...d,
                raise_on_status: v.trim() === "" ? undefined : v,
              }));
            }}
            placeholder="e.g. 4xx, 5xx, 403"
          />
          {isExpanded && (
            <div className="text-xs text-muted-foreground/70">
              Comma-separated patterns or codes. Keep it empty to not treat responses as failures by
              status.
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
