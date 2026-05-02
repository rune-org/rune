import { describe, expect, it } from "vitest";
import {
  isSameNodeExecutionInstance,
  nodeExecutionInstanceKey,
  rtesUpdateToNodeData,
  type NodeExecutionData,
} from "./execution";

function execution(overrides: Partial<NodeExecutionData>): NodeExecutionData {
  return {
    nodeId: "log-1",
    status: "running",
    ...overrides,
  };
}

describe("execution instance identity", () => {
  it("keeps split item identity stable as RTES sends richer lineage metadata", () => {
    const pending = execution({ itemIndex: 3, totalItems: 5 });
    const completed = execution({
      status: "success",
      lineageHash: "abc123",
      splitNodeId: "split-1",
      branchId: "branch-3",
      itemIndex: 3,
      totalItems: 5,
    });

    expect(isSameNodeExecutionInstance(pending, completed)).toBe(true);
  });

  it("does not merge different split items", () => {
    expect(
      isSameNodeExecutionInstance(
        execution({ splitNodeId: "split-1", itemIndex: 3, totalItems: 5 }),
        execution({ splitNodeId: "split-1", itemIndex: 4, totalItems: 5 }),
      ),
    ).toBe(false);
  });

  it("derives split item metadata from lineage stack updates", () => {
    const nodeData = rtesUpdateToNodeData({
      node_id: "log-1",
      status: "running",
      lineage_hash: "lineage-1",
      lineage_stack: [
        {
          split_node_id: "split-1",
          branch_id: "branch-3",
          item_index: 3,
          total_items: 5,
        },
      ],
    });

    expect(nodeData).not.toBeNull();
    if (!nodeData) return;

    expect(nodeData).toMatchObject({
      splitNodeId: "split-1",
      branchId: "branch-3",
      itemIndex: 3,
      totalItems: 5,
    });
    expect(nodeExecutionInstanceKey(nodeData)).toBe("stack:split-1:3");
  });
});
