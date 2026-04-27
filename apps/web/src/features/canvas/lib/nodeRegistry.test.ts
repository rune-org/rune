import { describe, expect, it } from "vitest";
import { getNodeDefaults } from "./nodeRegistry";

describe("nodeRegistry defaults", () => {
  it("keeps example-like configuration values out of new node data", () => {
    expect(getNodeDefaults("http").data.url).toBeUndefined();

    const smtpDefaults = getNodeDefaults("smtp").data;
    expect(smtpDefaults.from).toBeUndefined();
    expect(smtpDefaults.to).toBeUndefined();

    const editDefaults = getNodeDefaults("edit").data;
    expect(editDefaults.assignments?.[0]?.name).toBe("");
  });
});
