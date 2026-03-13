"use client";

/**
 * SAMLConfigTab
 *
 * Admin SAML configuration UI wired to generated SDK endpoints.
 * Features:
 *  - Status card with inline Enable/Disable toggle
 *  - Pill-style sub-navigation: Setup Guide • Service Provider • Identity Provider
 *  - SP panel: copy-ready read-only fields
 *  - IdP form: inline validation feedback
 *  - Danger zone: delete with confirmation dialog
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  ShieldOff,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Save,
  Info,
  BookOpen,
  Server,
  Building2,
  ChevronRight,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Upload,
  Download,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "@/components/ui/toast";
import {
  createSamlConfigAuthSamlConfigPost,
  deleteSamlConfigAuthSamlConfigDelete,
  getSamlConfigAuthSamlConfigGet,
  updateSamlConfigAuthSamlConfigPut,
} from "@/client";
import type {
  SamlConfigCreate,
  SamlConfigResponse,
  SamlConfigUpdate,
} from "@/client/types.gen";
import { cn } from "@/lib/cn";

interface SamlFormValues {
  name: string;
  entityId: string;
  ssoUrl: string;
  sloUrl: string;
  cert: string;
  domain: string;
}

function toFormValues(config: SamlConfigResponse | null): SamlFormValues {
  return {
    name: config?.name ?? "",
    entityId: config?.idp_entity_id ?? "",
    ssoUrl: config?.idp_sso_url ?? "",
    sloUrl: config?.idp_slo_url ?? "",
    cert: "",
    domain: config?.domain_hint ?? "",
  };
}

function toCreatePayload(values: SamlFormValues): SamlConfigCreate {
  return {
    name: values.name.trim(),
    idp_entity_id: values.entityId.trim(),
    idp_sso_url: values.ssoUrl.trim(),
    idp_slo_url: values.sloUrl.trim() || null,
    idp_certificate: values.cert.trim(),
    domain_hint: values.domain.trim() || null,
  };
}

function toUpdatePayload(values: SamlFormValues): SamlConfigUpdate {
  return {
    name: values.name.trim(),
    idp_entity_id: values.entityId.trim(),
    idp_sso_url: values.ssoUrl.trim(),
    idp_slo_url: values.sloUrl.trim() || null,
    domain_hint: values.domain.trim() || null,
    ...(values.cert.trim() ? { idp_certificate: values.cert.trim() } : {}),
  };
}

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

// Shared helpers

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const resetCopiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetCopiedTimeoutRef.current) {
        clearTimeout(resetCopiedTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    if (resetCopiedTimeoutRef.current) {
      clearTimeout(resetCopiedTimeoutRef.current);
    }
    resetCopiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy to clipboard"}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs transition-all",
        copied
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500"
          : "border-border/60 bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function ReadOnlyField({
  label,
  value,
  hint,
  mono = true,
  multiline = false,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </Label>
        <CopyButton value={value} />
      </div>

      {multiline ? (
        <div
          className={cn(
            "max-h-32 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-[11px] leading-relaxed text-foreground/80",
            mono && "font-mono break-all",
          )}
        >
          {value}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
          <span
            className={cn(
              "flex-1 truncate text-sm text-foreground/90",
              mono && "font-mono text-[11px]",
            )}
          >
            {value}
          </span>
        </div>
      )}

      {hint && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// Sub-navigation

type SubTab = "guide" | "sp" | "idp";

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: "guide", label: "Setup Guide",       icon: BookOpen  },
  { id: "sp",    label: "Service Provider",  icon: Server    },
  { id: "idp",   label: "Identity Provider", icon: Building2 },
];

// Panel: Setup Guide

const SETUP_STEPS = [
  {
    n: 1,
    title: "Fill in your Identity Provider details",
    desc: "Grab the Entity ID, SSO URL, and signing certificate from your IdP metadata (Okta, Azure AD, Authentik, ADFS…). Paste them in the Identity Provider tab.",
    cta: "idp" as SubTab,
    ctaLabel: "Open Identity Provider →",
  },
  {
    n: 2,
    title: "Copy your Service Provider details to your IdP",
    desc: "Open the Service Provider tab and paste the ACS URL, Entity ID, and (optionally) SP certificate into your IdP application settings.",
    cta: "sp" as SubTab,
    ctaLabel: "Open Service Provider →",
  },
  {
    n: 3,
    title: "Optionally set an email domain hint",
    desc: "Users whose email belongs to that domain will be auto-redirected to SSO at sign-in — no need to click a separate 'Sign in with SSO' button.",
    cta: undefined,
  },
  {
    n: 4,
    title: "Enable & test",
    desc: "Flip the toggle at the top of this page. Open a private window, sign in with a domain-matching email, and confirm the SAML flow completes successfully before rolling out to your team.",
    cta: undefined,
  },
];

function SetupGuidePanel({ onNav }: { onNav: (t: SubTab) => void }) {
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
        <p className="text-sm leading-relaxed text-blue-400/90">
          SAML 2.0 lets your team authenticate using your corporate identity provider.
          Complete the steps below to wire up the integration.
        </p>
      </div>

      <div className="grid gap-3">
        {SETUP_STEPS.map(({ n, title, desc, cta, ctaLabel }) => (
          <div
            key={n}
            className="flex gap-4 rounded-xl border border-border/50 bg-card px-5 py-4"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
              {n}
            </div>
            <div className="grid gap-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
              {cta && (
                <button
                  type="button"
                  onClick={() => onNav(cta)}
                  className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  {ctaLabel}
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Panel: Service Provider (read-only)

function ServiceProviderPanel({ config }: { config: SamlConfigResponse | null }) {
  const handleExport = () => {
    if (!config) {
      return;
    }

    // Strip PEM headers/whitespace to get raw base64 cert content
    const certContent = config.sp_certificate
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s+/g, "")
      .trim();

    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<md:EntityDescriptor`,
      `  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"`,
      `  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"`,
      `  entityID="${config.sp_entity_id}">`,
      `  <md:SPSSODescriptor`,
      `    AuthnRequestsSigned="false"`,
      `    WantAssertionsSigned="true"`,
      `    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">`,
      `    <md:KeyDescriptor use="signing">`,
      `      <ds:KeyInfo>`,
      `        <ds:X509Data>`,
      `          <ds:X509Certificate>${certContent}</ds:X509Certificate>`,
      `        </ds:X509Data>`,
      `      </ds:KeyInfo>`,
      `    </md:KeyDescriptor>`,
      `    <md:SingleLogoutService`,
      `      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"`,
      `      Location="${config.sp_slo_url}"/>`,
      `    <md:AssertionConsumerService`,
      `      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"`,
      `      Location="${config.sp_acs_url}"`,
      `      index="1"/>`,
      `  </md:SPSSODescriptor>`,
      `</md:EntityDescriptor>`,
    ].join("\n");

    const blob = new Blob([xml], { type: "application/xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "rune-sp-metadata.xml";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("SP metadata exported", {
      description: "SAML SP metadata XML downloaded successfully.",
    });
  };

  return (
    <div className="grid gap-6">
      {/* Export bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
        <div>
          <p className="text-xs font-semibold">Share with your IdP</p>
          <p className="text-[11px] text-muted-foreground">
            Download standard SAML SP metadata XML to import directly into your identity provider.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={handleExport}
          disabled={!config}
        >
          <Download className="h-3.5 w-3.5" />
          Export SP metadata XML
        </Button>
      </div>

      {!config && (
        <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Save an Identity Provider configuration first. Service Provider values are generated by the backend after creation.
          </p>
        </div>
      )}

      {config && (
        <>

      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-sm leading-relaxed text-amber-400/90">
          Copy these values into your IdP. If your IdP supports metadata import, just paste
          the{" "}
          <a
            href={config.sp_metadata_url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Metadata URL
          </a>{" "}
          and skip the rest.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <ReadOnlyField
          label="Entity ID / Audience URI"
          value={config.sp_entity_id}
          hint="Set as 'Audience URI' or 'SP Entity ID' in your IdP."
        />
        <ReadOnlyField
          label="Assertion Consumer Service (ACS) URL"
          value={config.sp_acs_url}
          hint="The SAML callback endpoint your IdP redirects to."
        />
        <ReadOnlyField
          label="Metadata URL"
          value={config.sp_metadata_url}
          hint="Import in your IdP to auto-fill all SP fields at once."
        />
        <ReadOnlyField
          label="Single Logout (SLO) URL"
          value={config.sp_slo_url}
          hint="Optional — enables IdP-initiated global logout."
        />
      </div>

      <Separator />

      <ReadOnlyField
        label="SP Signing Certificate (PEM)"
        value={config.sp_certificate}
        hint="Paste into your IdP so it can verify signed AuthnRequests from RUNE."
        multiline
      />

      <a
        href={config.sp_metadata_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Open metadata XML in browser
      </a>
      </>
      )}
    </div>
  );
}

// Panel: Identity Provider (editable form)

function IdentityProviderPanel({
  config,
  hasConfig,
  onSave,
  onDelete,
  submitting,
}: {
  config: SamlConfigResponse | null;
  hasConfig: boolean;
  onSave: (values: SamlFormValues) => Promise<void>;
  onDelete: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const [entityId, setEntityId] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [sloUrl, setSloUrl] = useState("");
  const [cert, setCert] = useState("");
  const [domain, setDomain] = useState("");
  const [saved, setSaved] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const resetSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const values = toFormValues(config);
    setName(values.name);
    setEntityId(values.entityId);
    setSsoUrl(values.ssoUrl);
    setSloUrl(values.sloUrl);
    setCert(values.cert);
    setDomain(values.domain);
  }, [config]);

  useEffect(() => {
    return () => {
      if (resetSavedTimeoutRef.current) {
        clearTimeout(resetSavedTimeoutRef.current);
      }
    };
  }, []);

  // Import IdP metadata XML or JSON config file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        if (file.name.endsWith(".xml")) {
          // Parse IdP metadata XML via DOMParser
          const parser = new DOMParser();
          const doc    = parser.parseFromString(text, "application/xml");

          const root = doc.querySelector("EntityDescriptor");
          if (!root) throw new Error("No EntityDescriptor found in XML.");

          const parsedEntityId = root.getAttribute("entityID") ?? "";
          const ssoEl = doc.querySelector(
            "IDPSSODescriptor SingleSignOnService[Binding*='HTTP-Redirect'], " +
            "IDPSSODescriptor SingleSignOnService"
          );
          const sloEl = doc.querySelector(
            "IDPSSODescriptor SingleLogoutService[Binding*='HTTP-Redirect'], " +
            "IDPSSODescriptor SingleLogoutService"
          );
          const certEl = doc.querySelector("IDPSSODescriptor KeyDescriptor X509Certificate") ??
                         doc.querySelector("X509Certificate");

          if (parsedEntityId) setEntityId(parsedEntityId);
          if (ssoEl?.getAttribute("Location")) setSsoUrl(ssoEl.getAttribute("Location")!);
          if (sloEl?.getAttribute("Location")) setSloUrl(sloEl.getAttribute("Location")!);
          if (certEl?.textContent) {
            const raw = certEl.textContent.trim().replace(/\s+/g, "");
            setCert(
              `-----BEGIN CERTIFICATE-----\n${raw.match(/.{1,64}/g)?.join("\n") ?? raw}\n-----END CERTIFICATE-----`
            );
          }
        } else {
          // JSON format
          const json = JSON.parse(text);
          if (json.name)            setName(json.name);
          if (json.idp_entity_id)   setEntityId(json.idp_entity_id);
          if (json.idp_sso_url)     setSsoUrl(json.idp_sso_url);
          if (json.idp_slo_url !== undefined) setSloUrl(json.idp_slo_url ?? "");
          if (json.idp_certificate) setCert(json.idp_certificate);
          if (json.domain_hint !== undefined) setDomain(json.domain_hint ?? "");
        }
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : "Failed to parse file.");
      } finally {
        // Reset so the same file can be re-imported
        e.target.value = "";
      }
    };
    reader.readAsText(file);
    toast.success("File imported", {
      description: "IdP metadata imported successfully. Review the values and click Save.",
    });
  };

  const hasCertificateInput = cert.trim().length > 0;
  const certOk =
    hasCertificateInput && cert.trim().startsWith("-----BEGIN CERTIFICATE-----");

  const isValid =
    name.trim().length > 0 &&
    entityId.trim().length > 0 &&
    ssoUrl.trim().startsWith("http") &&
    (hasConfig ? !hasCertificateInput || certOk : certOk);

  const handleSave = async () => {
    try {
      await onSave({ name, entityId, ssoUrl, sloUrl, cert, domain });
      setSaved(true);
      if (resetSavedTimeoutRef.current) {
        clearTimeout(resetSavedTimeoutRef.current);
      }
      resetSavedTimeoutRef.current = setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaved(false);
    }
  };

  return (
    <div className="grid gap-8">

      {/* Import action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
        <div>
          <p className="text-xs font-semibold">Import from file</p>
          <p className="text-[11px] text-muted-foreground">
            Upload your IdP metadata XML or a previously saved JSON config to auto-fill the form.
          </p>
        </div>
        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept=".json,.xml"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Import IdP metadata
        </Button>
      </div>

      {/* Import error feedback */}
      {importError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{importError}</span>
        </div>
      )}

      {/* Form fields */}
      <div className="grid gap-5">
        {/* Name */}
        <div className="grid gap-1.5">
          <Label htmlFor="idp-name">
            Configuration Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="idp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Okta, Azure AD, Authentik"
            maxLength={80}
          />
          <p className="text-[11px] text-muted-foreground">
            A display label for this identity provider.
          </p>
        </div>

        <Separator />

        {/* Entity ID */}
        <div className="grid gap-1.5">
          <Label htmlFor="idp-entity">
            IdP Entity ID <span className="text-destructive">*</span>
          </Label>
          <Input
            id="idp-entity"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="https://idp.example.com/app/id"
            maxLength={512}
          />
          <p className="text-[11px] text-muted-foreground">
            From your IdP metadata under{" "}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">entityID</code>.
          </p>
        </div>

        {/* SSO URL */}
        <div className="grid gap-1.5">
          <Label htmlFor="idp-sso">
            SSO Redirect URL <span className="text-destructive">*</span>
          </Label>
          <Input
            id="idp-sso"
            value={ssoUrl}
            onChange={(e) => setSsoUrl(e.target.value)}
            placeholder="https://idp.example.com/sso/saml/redirect"
          />
          <p className="text-[11px] text-muted-foreground">
            Users are sent here to authenticate with your IdP.
          </p>
        </div>

        {/* SLO URL */}
        <div className="grid gap-1.5">
          <Label htmlFor="idp-slo">
            Single Logout URL{" "}
            <span className="font-normal text-[11px] text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="idp-slo"
            value={sloUrl}
            onChange={(e) => setSloUrl(e.target.value)}
            placeholder="https://idp.example.com/slo/saml"
          />
          <p className="text-[11px] text-muted-foreground">
            Leave blank if your IdP doesn&apos;t support SLO.
          </p>
        </div>

        {/* Certificate */}
        <div className="grid gap-1.5">
          <Label htmlFor="idp-cert">
            IdP Signing Certificate (PEM){" "}
            {!hasConfig && <span className="text-destructive">*</span>}
          </Label>
          <Textarea
            id="idp-cert"
            value={cert}
            onChange={(e) => setCert(e.target.value)}
            placeholder={"-----BEGIN CERTIFICATE-----\nMIIDez...\n-----END CERTIFICATE-----"}
            rows={6}
            className="resize-y font-mono text-[11px] leading-relaxed"
          />
          {hasCertificateInput && !certOk && (
            <p className="flex items-center gap-1.5 text-[11px] text-destructive">
              <AlertCircle className="h-3 w-3 shrink-0" />
              Must start with{" "}
              <code className="rounded bg-muted px-1 font-mono text-[10px]">
                -----BEGIN CERTIFICATE-----
              </code>
            </p>
          )}
          {certOk && (
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-500">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              Certificate format looks valid.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {hasConfig
              ? "Leave blank to keep your current certificate. Provide a value only when rotating certificates."
              : "X.509 certificate from your IdP metadata. Include full PEM headers."}
          </p>
        </div>

        {/* Domain hint — styled as a callout block */}
        <div className="grid gap-3 rounded-xl border border-border/50 bg-muted/20 px-5 py-4">
          <div>
            <p className="text-sm font-semibold">
              Email Domain Hint{" "}
              <span className="font-normal text-[11px] text-muted-foreground">(optional)</span>
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Users whose email matches this domain will be auto-redirected to SSO on the
              sign-in page — no extra button click required.
            </p>
          </div>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="acme.com"
            maxLength={253}
            className="max-w-xs"
          />
        </div>
      </div>

      {/* Save row */}
      <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-5">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-500 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4" />
            Configuration saved
          </span>
        )}
        <Button onClick={() => void handleSave()} disabled={!isValid || submitting} className="gap-2">
          <Save className="h-4 w-4" />
          {submitting ? "Saving…" : hasConfig ? "Update Configuration" : "Create Configuration"}
        </Button>
      </div>

      {/* Danger zone */}
      {hasConfig && (
      <div className="rounded-xl border border-destructive/25 bg-destructive/5 overflow-hidden">
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-destructive">Danger Zone</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Permanently removes this IdP integration. All users will revert to password
            authentication. This action cannot be undone.
          </p>
        </div>
        <Separator className="bg-destructive/20" />
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-medium">Remove SAML configuration</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Currently linked to: <span className="font-medium">{name}</span>
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={submitting}
            className="gap-1.5 shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}

// Root Component

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

      {/* Status card with toggle */}
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
              <p className="text-sm font-semibold leading-tight">
                SAML 2.0 — {configName}
              </p>
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
                ? "SAML is disabled — users use password authentication"
                : "Create an Identity Provider configuration to enable SSO"}
            </p>
          </div>
        </div>

        {/* Toggle — intentionally placed right next to the status indicator */}
        <div className="flex items-center gap-3 sm:shrink-0">
          <span className="text-xs font-medium text-muted-foreground">
            {enabled ? "Enabled" : "Disabled"}
          </span>
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
        </div>
      </Card>

      {/* Sub-navigation tabs */}
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

      {/* Panel content */}
      {activeSubTab === "guide" && (
        <SetupGuidePanel onNav={setActiveSubTab} />
      )}
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

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remove SAML configuration?"
        description={
          <span>
            This permanently deletes the SAML integration for{" "}
            <strong>{configName}</strong>. All users will revert to password
            authentication. This cannot be undone.
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
