import type { Node } from "@xyflow/react";
import type { HttpData, NodeDataMap } from "../../types";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import { JsonField } from "../JsonField";

type HttpInspectorProps = {
  node: Node<HttpData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
  isExpanded: boolean;
};

export function HttpInspector({
  node,
  updateData,
  isExpanded,
}: HttpInspectorProps) {
  const updateHttpData = (updater: (data: HttpData) => HttpData) => {
    updateData(node.id, "http", updater);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted-foreground">Method</label>
          <select
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
            value={node.data.method ?? "GET"}
            onChange={(e) =>
              updateHttpData((d) => ({
                ...d,
                method: e.target.value as NodeDataMap["http"]["method"],
              }))
            }
          >
            {"GET POST PUT PATCH DELETE".split(" ").map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">
            Timeout (s)
          </label>
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
        <input
          className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
          value={node.data.url ?? ""}
          onChange={(e) =>
            updateHttpData((d) => ({
              ...d,
              url: e.target.value,
            }))
          }
          placeholder="https://api.example.com/path"
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
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Headers (JSON object)
        </summary>
        <JsonField
          value={node.data.headers}
          onChange={(obj) =>
            updateHttpData((d) => ({
              ...d,
              headers: obj,
            }))
          }
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
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Query Params (JSON object)
        </summary>
        <JsonField
          value={node.data.query}
          onChange={(obj) =>
            updateHttpData((d) => ({
              ...d,
              query: obj,
            }))
          }
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
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Body (JSON)
        </summary>
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
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Advanced
        </summary>
        <div className="mt-2 space-y-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={node.data.ignoreSSL ?? false}
              onChange={(e) =>
                updateHttpData((d) => ({
                  ...d,
                  ignoreSSL: e.target.checked,
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
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1"
            value={node.data.retries ?? 0}
            onChange={(e) =>
              updateHttpData((d) => ({
                ...d,
                retries: Number(e.target.value),
              }))
            }
          />
          {isExpanded && (
            <div className="text-xs text-muted-foreground/70">
              Number of retry attempts on failure
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
