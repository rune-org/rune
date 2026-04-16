import type { SamlConfigCreate, SamlConfigResponse, SamlConfigUpdate } from "@/client/types.gen";

import type { SamlFormValues } from "./types";

export function toFormValues(config: SamlConfigResponse | null): SamlFormValues {
  return {
    name: config?.name ?? "",
    entityId: config?.idp_entity_id ?? "",
    ssoUrl: config?.idp_sso_url ?? "",
    sloUrl: config?.idp_slo_url ?? "",
    cert: "",
    domain: config?.domain_hint ?? "",
  };
}

export function toCreatePayload(values: SamlFormValues): SamlConfigCreate {
  return {
    name: values.name.trim(),
    idp_entity_id: values.entityId.trim(),
    idp_sso_url: values.ssoUrl.trim(),
    idp_slo_url: values.sloUrl.trim() || null,
    idp_certificate: values.cert.trim(),
    domain_hint: values.domain.trim() || null,
  };
}

export function toUpdatePayload(values: SamlFormValues): SamlConfigUpdate {
  return {
    name: values.name.trim(),
    idp_entity_id: values.entityId.trim(),
    idp_sso_url: values.ssoUrl.trim(),
    idp_slo_url: values.sloUrl.trim() || null,
    domain_hint: values.domain.trim() || null,
    ...(values.cert.trim() ? { idp_certificate: values.cert.trim() } : {}),
  };
}
