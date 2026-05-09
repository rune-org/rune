import { describe, expect, it } from "vitest";
import { getAllGroups, getNodeDefaults, NODE_REGISTRY } from "./nodeRegistry";

describe("nodeRegistry defaults", () => {
  it("keeps example-like configuration values out of new node data", () => {
    expect(getNodeDefaults("http").data.url).toBeUndefined();

    const smtpDefaults = getNodeDefaults("smtp").data;
    expect(smtpDefaults.from).toBeUndefined();
    expect(smtpDefaults.to).toBeUndefined();

    const editDefaults = getNodeDefaults("edit").data;
    expect(editDefaults.assignments?.[0]?.name).toBe("");
  });

  it("registers integration nodes in provider library groups with defaults", () => {
    const gmailDefaults = getNodeDefaults("integration.google.gmail.send_email").data;

    expect(getAllGroups()).toContain("google");
    expect(getAllGroups()).toContain("microsoft");
    expect(NODE_REGISTRY["integration.google.gmail.send_email"]).toMatchObject({
      group: "google",
      label: "Gmail: Send Email",
      iconSrc: "/icons/integrations/google-gmail.svg",
      colorTheme: {
        base: "hsl(5 79% 53%)",
      },
    });
    expect(gmailDefaults).toEqual({
      label: "Send Email",
      integrationKind: "integration.google.gmail.send_email",
      arguments: {},
    });
  });
});
