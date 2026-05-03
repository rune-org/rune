import { useCallback } from "react";
import Image from "next/image";
import type { Node } from "@xyflow/react";
import { JsonField } from "../JsonField";
import { VariableInput } from "../variable-picker/VariableInput";
import { useUpdateNodeData } from "../../hooks/useUpdateNodeData";
import type { IntegrationArgumentField, IntegrationNodeData } from "../../integrations/types";
import { getIntegrationTool } from "../../integrations/helpers";
import { CredentialSelector } from "@/components/shared/CredentialSelector";
import type { CredentialRef } from "@/lib/credentials";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type IntegrationInspectorProps = {
  node: Node<IntegrationNodeData>;
  updateData: ReturnType<typeof useUpdateNodeData>;
};

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      {required ? " *" : ""}
    </label>
  );
}

export function IntegrationInspector({ node, updateData }: IntegrationInspectorProps) {
  const tool = getIntegrationTool(node.data.integrationKind);

  const updateIntegrationData = useCallback(
    (updater: (data: IntegrationNodeData) => IntegrationNodeData) => {
      updateData(node.id, node.data.integrationKind, updater);
    },
    [updateData, node.id, node.data.integrationKind],
  );

  const handleCredentialChange = useCallback(
    (credential: CredentialRef | null) => {
      updateIntegrationData((data) => ({ ...data, credential: credential ?? undefined }));
    },
    [updateIntegrationData],
  );

  const updateArgument = useCallback(
    (name: string, value: unknown) => {
      updateIntegrationData((data) => ({
        ...data,
        arguments: Object.fromEntries(
          Object.entries({
            ...(data.arguments ?? {}),
            [name]: value,
          }).filter(([, entryValue]) => entryValue !== undefined),
        ),
      }));
    },
    [updateIntegrationData],
  );

  const renderField = (field: IntegrationArgumentField) => {
    const value = node.data.arguments?.[field.name];

    if (field.type === "boolean") {
      return (
        <label
          key={field.name}
          className="flex items-center gap-2 rounded-[calc(var(--radius)-0.25rem)] border border-border/50 bg-muted/20 px-2 py-2 text-sm"
        >
          <input
            type="checkbox"
            className="h-4 w-4 accent-ring"
            checked={Boolean(value)}
            onChange={(event) => updateArgument(field.name, event.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );
    }

    if (field.type === "select") {
      // Prefer stored value, then the tool's declared default, then the first option.
      const selectValue =
        typeof value === "string"
          ? value
          : ((tool?.defaultArguments[field.name] as string | undefined) ??
            field.options?.[0]?.value);
      return (
        <div key={field.name}>
          <FieldLabel label={field.label} required={field.required} />
          <Select
            value={selectValue}
            onValueChange={(nextValue) => updateArgument(field.name, nextValue)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.help && <div className="mt-1 text-xs text-muted-foreground/70">{field.help}</div>}
        </div>
      );
    }

    if (field.type === "json") {
      return (
        <div key={field.name}>
          <FieldLabel label={field.label} required={field.required} />
          <JsonField
            value={value}
            objectOnly={false}
            onChange={(nextValue) => updateArgument(field.name, nextValue)}
          />
          {field.help && <div className="mt-1 text-xs text-muted-foreground/70">{field.help}</div>}
        </div>
      );
    }

    if (field.type === "number") {
      return (
        <div key={field.name}>
          <FieldLabel label={field.label} required={field.required} />
          <input
            type="number"
            className="w-full rounded-[calc(var(--radius)-0.25rem)] border border-input bg-muted/30 px-2 py-1 text-sm"
            value={typeof value === "number" || typeof value === "string" ? value : ""}
            placeholder={field.placeholder}
            onChange={(event) => {
              const nextValue = event.target.value;
              updateArgument(field.name, nextValue === "" ? undefined : Number(nextValue));
            }}
          />
          {field.help && <div className="mt-1 text-xs text-muted-foreground/70">{field.help}</div>}
        </div>
      );
    }

    return (
      <div key={field.name}>
        <FieldLabel label={field.label} required={field.required} />
        <VariableInput
          value={typeof value === "string" ? value : ""}
          onChange={(nextValue) => updateArgument(field.name, nextValue)}
          placeholder={field.placeholder}
          nodeId={node.id}
          multiline={field.type === "textarea"}
        />
        {field.help && <div className="mt-1 text-xs text-muted-foreground/70">{field.help}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {tool && (
        <div className="flex items-start gap-2 rounded-[calc(var(--radius)-0.25rem)] border border-border/50 bg-muted/20 p-2">
          <Image
            src={tool.icon}
            alt=""
            width={20}
            height={20}
            className="mt-0.5 h-5 w-5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{tool.serviceLabel}</div>
            <div className="truncate text-xs text-muted-foreground">{tool.description}</div>
          </div>
        </div>
      )}

      <CredentialSelector
        credentialType="oauth2"
        value={node.data.credential ?? null}
        onChange={handleCredentialChange}
        label={tool ? `${tool.providerLabel} Account` : "Account"}
        placeholder="Select account"
      />

      {tool && tool.argumentFields.length > 0 ? (
        <div className="space-y-3">{tool.argumentFields.map(renderField)}</div>
      ) : (
        <div className="rounded-[calc(var(--radius)-0.25rem)] border border-border/40 bg-muted/20 p-2 text-xs text-muted-foreground/70">
          This tool does not require arguments.
        </div>
      )}

      <details className="rounded-[calc(var(--radius)-0.25rem)] border border-border/60 bg-muted/20 p-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Advanced JSON</summary>
        <JsonField
          value={node.data.arguments}
          onChange={(value) => {
            if (!isJsonObject(value)) return;
            updateIntegrationData((data) => ({ ...data, arguments: value }));
          }}
        />
      </details>
    </div>
  );
}
