"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Save, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { SamlConfigResponse } from "@/client/types.gen";

import { toFormValues } from "./form";
import type { SamlFormValues } from "./types";

interface IdentityProviderPanelProps {
  config: SamlConfigResponse | null;
  hasConfig: boolean;
  onSave: (values: SamlFormValues) => Promise<void>;
  onDelete: () => void;
  submitting: boolean;
}

export function IdentityProviderPanel({
  config,
  hasConfig,
  onSave,
  onDelete,
  submitting,
}: IdentityProviderPanelProps) {
  const [form, setForm] = useState<SamlFormValues>(toFormValues(config));
  const [saved, setSaved] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const resetSavedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(toFormValues(config));
  }, [config]);

  const updateField = <K extends keyof SamlFormValues>(field: K, value: SamlFormValues[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    return () => {
      if (resetSavedTimeoutRef.current) {
        clearTimeout(resetSavedTimeoutRef.current);
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const updates: Partial<SamlFormValues> = {};

        if (file.name.endsWith(".xml")) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, "application/xml");

          const root = doc.querySelector("EntityDescriptor");
          if (!root) throw new Error("No EntityDescriptor found in XML.");

          const parsedEntityId = root.getAttribute("entityID") ?? "";
          const ssoEl = doc.querySelector(
            "IDPSSODescriptor SingleSignOnService[Binding*='HTTP-Redirect'], " +
              "IDPSSODescriptor SingleSignOnService",
          );
          const sloEl = doc.querySelector(
            "IDPSSODescriptor SingleLogoutService[Binding*='HTTP-Redirect'], " +
              "IDPSSODescriptor SingleLogoutService",
          );
          const certEl =
            doc.querySelector("IDPSSODescriptor KeyDescriptor X509Certificate") ??
            doc.querySelector("X509Certificate");

          if (parsedEntityId) updates.entityId = parsedEntityId;
          if (ssoEl?.getAttribute("Location")) updates.ssoUrl = ssoEl.getAttribute("Location")!;
          if (sloEl?.getAttribute("Location")) updates.sloUrl = sloEl.getAttribute("Location")!;
          if (certEl?.textContent) {
            const raw = certEl.textContent.trim().replace(/\s+/g, "");
            updates.cert = `-----BEGIN CERTIFICATE-----\n${raw.match(/.{1,64}/g)?.join("\n") ?? raw}\n-----END CERTIFICATE-----`;
          }
        } else {
          const json = JSON.parse(text);
          if (json.name) updates.name = json.name;
          if (json.idp_entity_id) updates.entityId = json.idp_entity_id;
          if (json.idp_sso_url) updates.ssoUrl = json.idp_sso_url;
          if (json.idp_slo_url !== undefined) updates.sloUrl = json.idp_slo_url ?? "";
          if (json.idp_certificate) updates.cert = json.idp_certificate;
          if (json.domain_hint !== undefined) updates.domain = json.domain_hint ?? "";
        }

        setForm((prev) => ({ ...prev, ...updates }));
        toast.success("File imported", {
          description: "IdP metadata imported successfully. Review the values and click Save.",
        });
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : "Failed to parse file.");
      } finally {
        e.target.value = "";
      }
    };

    reader.onerror = () => {
      setImportError("Failed to read file.");
      e.target.value = "";
    };

    reader.readAsText(file);
  };

  const hasCertificateInput = form.cert.trim().length > 0;
  const certOk = hasCertificateInput && form.cert.trim().startsWith("-----BEGIN CERTIFICATE-----");

  const isValid =
    form.name.trim().length > 0 &&
    form.entityId.trim().length > 0 &&
    form.ssoUrl.trim().startsWith("http") &&
    (hasConfig ? !hasCertificateInput || certOk : certOk);

  const handleSave = async () => {
    try {
      await onSave(form);
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
        <div>
          <p className="text-xs font-semibold">Import from file</p>
          <p className="text-[11px] text-muted-foreground">
            Upload your IdP metadata XML or a previously saved JSON config to auto-fill the form.
          </p>
        </div>
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

      {importError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{importError}</span>
        </div>
      )}

      <div className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="idp-name">
            Configuration Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="idp-name"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g. Okta, Azure AD, Authentik"
            maxLength={80}
          />
          <p className="text-[11px] text-muted-foreground">
            A display label for this identity provider.
          </p>
        </div>

        <Separator />

        <div className="grid gap-1.5">
          <Label htmlFor="idp-entity">
            IdP Entity ID <span className="text-destructive">*</span>
          </Label>
          <Input
            id="idp-entity"
            value={form.entityId}
            onChange={(e) => updateField("entityId", e.target.value)}
            placeholder="https://idp.example.com/app/id , urn:example:idp , or just 'idp-name'"
            maxLength={512}
          />
          <p className="text-[11px] text-muted-foreground">
            From your IdP metadata under{" "}
            <code className="rounded bg-muted px-1 font-mono text-[10px]">entityID</code>. Can be a
            URL, URI, or any string (e.g., some providers use just their name).
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="idp-sso">
            SSO Redirect URL <span className="text-destructive">*</span>
          </Label>
          <Input
            id="idp-sso"
            value={form.ssoUrl}
            onChange={(e) => updateField("ssoUrl", e.target.value)}
            placeholder="https://idp.example.com/sso/saml/redirect"
          />
          <p className="text-[11px] text-muted-foreground">
            Users are sent here to authenticate with your IdP.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="idp-slo">
            Single Logout URL{" "}
            <span className="font-normal text-[11px] text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="idp-slo"
            value={form.sloUrl}
            onChange={(e) => updateField("sloUrl", e.target.value)}
            placeholder="https://idp.example.com/slo/saml"
          />
          <p className="text-[11px] text-muted-foreground">
            Leave blank if your IdP doesn&apos;t support SLO.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="idp-cert">
            IdP Signing Certificate (PEM){" "}
            {!hasConfig && <span className="text-destructive">*</span>}
          </Label>
          <Textarea
            id="idp-cert"
            value={form.cert}
            onChange={(e) => updateField("cert", e.target.value)}
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

        <div className="grid gap-3 rounded-xl border border-border/50 bg-muted/20 px-5 py-4">
          <div>
            <p className="text-sm font-semibold">
              Email Domain Hint{" "}
              <span className="font-normal text-[11px] text-muted-foreground">(optional)</span>
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Users whose email matches this domain will be auto-redirected to SSO on the sign-in
              page - no extra button click required.
            </p>
          </div>
          <Input
            value={form.domain}
            onChange={(e) => updateField("domain", e.target.value)}
            placeholder="acme.com"
            maxLength={253}
            className="max-w-xs"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-5">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-500 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4" />
            Configuration saved
          </span>
        )}
        <Button
          onClick={() => void handleSave()}
          disabled={!isValid || submitting}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {submitting ? "Saving..." : hasConfig ? "Update Configuration" : "Create Configuration"}
        </Button>
      </div>

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
                Currently linked to: <span className="font-medium">{form.name}</span>
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
