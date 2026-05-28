import { describe, expect, it } from "vitest";
import { getIntegrationNodeKinds, getIntegrationTool, isIntegrationNodeKind } from "./helpers";

describe("integration catalog helpers", () => {
  it("recognizes and resolves integration node kinds", () => {
    expect(isIntegrationNodeKind("integration.google.gmail.send_email")).toBe(true);
    expect(isIntegrationNodeKind("integration.gmail.send_email")).toBe(false);

    expect(getIntegrationTool("integration.google.sheets.read_range")).toMatchObject({
      provider: "google",
      service: "sheets",
      tool: "read_range",
      icon: "/icons/integrations/google-sheets.svg",
    });
    expect(getIntegrationNodeKinds()).toContain("integration.microsoft.outlook.send_email");
  });
});
