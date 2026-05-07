import { describe, expect, it } from "vitest";
import { parseVariableReferences } from "./useVariableInput";

describe("parseVariableReferences", () => {
  it("parses root array item references", () => {
    expect(parseVariableReferences("$json[12].title")).toEqual([
      {
        full: "$json[12].title",
        nodeName: "json",
        fieldPath: "[12].title",
        start: 0,
        end: 15,
      },
    ]);
  });

  it("continues to parse dotted node output references", () => {
    expect(parseVariableReferences("$FetchPosts.body.posts[1].title")).toEqual([
      {
        full: "$FetchPosts.body.posts[1].title",
        nodeName: "FetchPosts",
        fieldPath: "body.posts[1].title",
        start: 0,
        end: 31,
      },
    ]);
  });
});
