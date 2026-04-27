import { describe, expect, it } from "vitest";
import { jsonToVariableTree } from "./variableSchema";

describe("jsonToVariableTree", () => {
  it("exposes concrete array items for small arrays", () => {
    const tree = jsonToVariableTree(
      {
        posts: [
          { id: 1, title: "First" },
          { id: 2, title: "Second" },
          { id: 3, title: "Third" },
        ],
      },
      "$FetchPosts",
    );

    const posts = tree.find((node) => node.key === "posts");
    expect(posts?.type).toBe("array");
    expect(posts?.arrayLength).toBe(3);
    expect(posts?.children?.map((child) => child.path)).toEqual([
      "$FetchPosts.posts[0]",
      "$FetchPosts.posts[1]",
      "$FetchPosts.posts[2]",
    ]);
    expect(posts?.children?.[1].children?.map((child) => child.path)).toContain(
      "$FetchPosts.posts[1].title",
    );
  });

  it("caps large arrays and preserves the real length for indexed lookup", () => {
    const posts = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      title: `Post ${index + 1}`,
    }));

    const tree = jsonToVariableTree({ posts }, "$FetchPosts");
    const postsNode = tree.find((node) => node.key === "posts");

    expect(postsNode?.arrayLength).toBe(60);
    expect(postsNode?.children).toHaveLength(10);
    expect(postsNode?.children?.at(-1)?.path).toBe("$FetchPosts.posts[9]");
  });

  it("does not invent an invalid [0] entry for empty arrays", () => {
    const tree = jsonToVariableTree({ posts: [] }, "$FetchPosts");
    const posts = tree.find((node) => node.key === "posts");

    expect(posts?.type).toBe("array");
    expect(posts?.children).toEqual([]);
  });

  it("keeps deeply nested fields reachable", () => {
    const tree = jsonToVariableTree(
      {
        one: {
          two: {
            three: {
              four: {
                five: {
                  six: {
                    value: "reachable",
                  },
                },
              },
            },
          },
        },
      },
      "$Deep",
    );

    const valueNode =
      tree[0].children?.[0].children?.[0].children?.[0].children?.[0].children?.[0].children?.[0];

    expect(valueNode?.path).toBe("$Deep.one.two.three.four.five.six.value");
  });
});
