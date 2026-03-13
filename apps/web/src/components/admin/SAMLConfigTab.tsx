"use client";

/**
 * SAMLConfigTab
 *
 * Admin SAML configuration UI wired to generated SDK endpoints.
 */

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  Server,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "@/components/ui/toast";
import {
  createSamlConfigAuthSamlConfigPost,
  deleteSamlConfigAuthSamlConfigDelete,
  getSamlConfigAuthSamlConfigGet,
  updateSamlConfigAuthSamlConfigPut,
} from "@/client";
import type { SamlConfigResponse } from "@/client/types.gen";
import { cn } from "@/lib/cn";

import { toCreatePayload, toUpdatePayload } from "./saml/form";
import { IdentityProviderPanel } from "./saml/IdentityProviderPanel";
import { ServiceProviderPanel } from "./saml/ServiceProviderPanel";
import { SetupGuidePanel } from "./saml/SetupGuidePanel";
import type { SamlFormValues, SubTab } from "./saml/types";

function isErrorWithDetail(
  error: unknown,
): error is { detail?: string; message?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    ("detail" in error || "message" in error)
  );
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }
  if (isErrorWithDetail(error)) {
    return error.detail ?? error.message ?? fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function isConfigNotFoundError(error: unknown): boolean {
  if (!isErrorWithDetail(error)) {
    return false;
  }
  const message = (error.detail ?? error.message ?? "").toLowerCase();
  return message.includes("no saml configuration found");
}

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: "guide", label: "Setup Guide", icon: BookOpen },
  { id: "sp", label: "Service Provider", icon: Server },
  { id: "idp", label: "Identity Provider", icon: Building2 },
];

export function SAMLConfigTab() {
  const [config, setConfig] = useState<SamlConfigResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("guide");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const response = await getSamlConfigAuthSamlConfigGet();
      setConfig(response.data?.data ?? null);
    } catch (error: unknown) {
      if (!isConfigNotFoundError(error)) {
        const message = extractErrorMessage(error, "Failed to load SAML configuration");
        toast.error("Unable to load SAML configuration", {
          description: message,
          action: {
            label: "Retry",
            onClick: () => {
              void loadConfig();
            },
          },
        });
      }
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSaveConfig = useCallback(
    async (values: SamlFormValues): Promise<void> => {
      setSubmitting(true);
      try {
        const response = config
          ? await updateSamlConfigAuthSamlConfigPut({ body: toUpdatePayload(values) })
          : await createSamlConfigAuthSamlConfigPost({ body: toCreatePayload(values) });

        const nextConfig = response.data?.data;
        if (!nextConfig) {
          throw new Error("Missing SAML config in response");
        }

        setConfig(nextConfig);
        toast.success(config ? "SAML configuration updated" : "SAML configuration created", {
          description: config
            ? "Identity provider details were saved successfully."
            : "Identity provider details were created successfully.",
        });
      } catch (error: unknown) {
        const message = extractErrorMessage(error, "Failed to save SAML configuration");
        toast.error("Unable to save SAML configuration", {
          description: message,
        });
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [config],
  );

  const handleToggleEnabled = useCallback(async () => {
    if (!config) {
      toast.info("SAML setup required", {
        description: "Create a SAML configuration before enabling single sign-on.",
      });
      setActiveSubTab("idp");
      return;
    }

    setSubmitting(true);
    try {
      const response = await updateSamlConfigAuthSamlConfigPut({
        body: { is_active: !config.is_active },
      });
      const nextConfig = response.data?.data;
      if (!nextConfig) {
        throw new Error("Missing SAML config in response");
      }
      setConfig(nextConfig);
      toast.success(nextConfig.is_active ? "SAML enabled" : "SAML disabled", {
        description: nextConfig.is_active
          ? "Users can now authenticate with your identity provider."
          : "Users will use password authentication until SAML is re-enabled.",
      });
    } catch (error: unknown) {
      const message = extractErrorMessage(error, "Failed to update SAML status");
      toast.error("Unable to update SAML status", {
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }, [config]);

  const handleDelete = useCallback(async (): Promise<boolean> => {
    if (!config) {
      setDeleteOpen(false);
      return true;
    }

    setSubmitting(true);
    try {
      await deleteSamlConfigAuthSamlConfigDelete();
      setConfig(null);
      setActiveSubTab("idp");
      toast.success("SAML configuration removed", {
        description: "All users have reverted to password authentication.",
      });
      return true;
    } catch (error: unknown) {
      const message = extractErrorMessage(error, "Failed to remove SAML configuration");
      toast.error("Unable to remove SAML configuration", {
        description: message,
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [config]);

  const enabled = config?.is_active ?? false;
  const configName = config?.name ?? "Not configured";
  const domainHint = config?.domain_hint;

  return (
    <div className="grid gap-6">
      {isLoading && (
        <Card className="px-6 py-5 text-sm text-muted-foreground">Loading SAML configuration...</Card>
      )}

      <Card className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
              enabled ? "bg-accent/15" : "bg-muted",
            )}
          >
            {enabled ? (
              <ShieldCheck className="h-5 w-5 text-accent" />
            ) : (
              <ShieldOff className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold leading-tight">SAML 2.0 - {configName}</p>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-2 py-0",
                  enabled
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                    : config
                      ? "border-border/60 text-muted-foreground"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-500",
                )}
              >
                {enabled ? "Active" : config ? "Inactive" : "Not Configured"}
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {enabled && domainHint
                ? `Auto-redirecting @${domainHint} users to SSO`
                : config
                  ? "SAML is disabled - users use password authentication"
                  : "Create an Identity Provider configuration to enable SSO"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:shrink-0">
          <span className="text-xs font-medium text-muted-foreground">
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => void handleToggleEnabled()}
                  disabled={!config || submitting}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
                    "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                    (!config || submitting) && "cursor-not-allowed opacity-70",
                    enabled ? "bg-accent" : "bg-muted-foreground/30",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                      enabled ? "translate-x-5" : "translate-x-0",
                    )}
                  />
                </button>
              </span>
            </TooltipTrigger>
            {!config && <TooltipContent>Create a configuration first</TooltipContent>}
          </Tooltip>
        </div>
      </Card>

      <div className="flex items-center gap-1 self-start rounded-xl border border-border/50 bg-muted/20 p-1">
        {SUB_TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeSubTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSubTab(id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-accent/15 text-accent border border-accent/30 shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", isActive && "text-accent")} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {activeSubTab === "guide" && <SetupGuidePanel onNav={setActiveSubTab} />}
      {activeSubTab === "sp" && <ServiceProviderPanel config={config} />}
      {activeSubTab === "idp" && (
        <IdentityProviderPanel
          config={config}
          hasConfig={Boolean(config)}
          onSave={handleSaveConfig}
          onDelete={() => setDeleteOpen(true)}
          submitting={submitting}
        />
      )}

      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove SAML configuration?"
        description={
          <span>
            This permanently deletes the SAML integration for <strong>{configName}</strong>. All
            users will revert to password authentication. This cannot be undone.
          </span>
        }
        confirmText="Yes, remove"
        cancelText="Cancel"
        isDangerous
        isLoading={submitting || !config}
        onConfirm={handleDelete}
      />
    </div>
  );
}
