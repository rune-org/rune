import { describe, expect, it } from "vitest";

import { toCreatePayload, toFormValues, toUpdatePayload } from "./form";

describe("SAML form helpers", () => {
  it("maps null configs to empty form values", () => {
    expect(toFormValues(null)).toEqual({
      name: "",
      entityId: "",
      ssoUrl: "",
      sloUrl: "",
      cert: "",
      domain: "",
    });
  });

  it("trims create payloads and nulls optional fields", () => {
    expect(
      toCreatePayload({
        name: "  Example SSO  ",
        entityId: "  entity-id  ",
        ssoUrl: "  https://idp.example.com/sso  ",
        sloUrl: "   ",
        cert: "  CERTIFICATE  ",
        domain: "   ",
      }),
    ).toEqual({
      name: "Example SSO",
      idp_entity_id: "entity-id",
      idp_sso_url: "https://idp.example.com/sso",
      idp_slo_url: null,
      idp_certificate: "CERTIFICATE",
      domain_hint: null,
    });
  });

  it("omits blank certificates from update payloads", () => {
    expect(
      toUpdatePayload({
        name: " Updated ",
        entityId: " entity ",
        ssoUrl: " https://example.com/sso ",
        sloUrl: " https://example.com/slo ",
        cert: "   ",
        domain: " team.example.com ",
      }),
    ).toEqual({
      name: "Updated",
      idp_entity_id: "entity",
      idp_sso_url: "https://example.com/sso",
      idp_slo_url: "https://example.com/slo",
      domain_hint: "team.example.com",
    });
  });
});
