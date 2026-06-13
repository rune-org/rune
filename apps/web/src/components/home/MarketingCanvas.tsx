"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "@/features/canvas/nodes";
import "@/features/canvas/styles/reactflow.css";
import { ExecutionProvider } from "@/features/canvas/context/ExecutionContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Play, RotateCcw } from "lucide-react";
import { MarketingEditNode } from "./MarketingEditNode";
import { MarketingDemoProvider } from "./marketingDemoContext";
import { useMarketingSim } from "./useMarketingSim";

const THRESHOLD = 1000;
const DEFAULT_AMOUNT = 1200;

const SLACK_KIND = "integration.slack.chat.post_message";
const MOCK_SLACK_CREDENTIAL = { type: "slack_oauth", id: "mock-slack-1", name: "Workspace Bot" };

const INITIAL_NODES: Node[] = [
  {
    id: "trgr-1",
    type: "trigger",
    position: { x: 20, y: 150 },
    data: { label: "Webhook" },
  },
  {
    id: "edit-1",
    type: "marketingEdit",
    position: { x: 280, y: 132 },
    data: { label: "Define Payload" },
  },
  {
    id: "if-1",
    type: "if",
    position: { x: 580, y: 150 },
    data: { label: "Is High Value?", expression: "payload.amount > 1000" },
  },
  {
    id: "slack-vip",
    type: SLACK_KIND,
    position: { x: 860, y: 40 },
    data: {
      label: "Alert VIP channel",
      integrationKind: SLACK_KIND,
      credential: MOCK_SLACK_CREDENTIAL,
      arguments: {
        channel: "#vip-deals",
        text: "🔥 High-value order received — routing to the deals desk.",
      },
    },
  },
  {
    id: "slack-team",
    type: SLACK_KIND,
    position: { x: 860, y: 260 },
    data: {
      label: "Notify team",
      integrationKind: SLACK_KIND,
      credential: MOCK_SLACK_CREDENTIAL,
      arguments: {
        channel: "#general",
        text: "New order received.",
      },
    },
  },
];

const plainEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  type: "default",
  animated: false,
  style: { stroke: "var(--border)" },
});

const branchEdge = (id: string, target: string, branch: "true" | "false"): Edge => ({
  ...plainEdge(id, "if-1", target),
  sourceHandle: branch,
  label: branch,
  labelStyle: { fill: "#ffffff", fontWeight: 600 },
  labelShowBg: true,
  labelBgStyle: { fill: branch === "true" ? "hsl(142 70% 45%)" : "hsl(0 70% 50%)" },
  labelBgPadding: [2, 6] as [number, number],
  labelBgBorderRadius: 4,
});

const INITIAL_EDGES: Edge[] = [
  plainEdge("edge-1", "trgr-1", "edit-1"),
  plainEdge("edge-2", "edit-1", "if-1"),
  branchEdge("edge-3", "slack-vip", "true"),
  branchEdge("edge-4", "slack-team", "false"),
];

const demoNodeTypes = { ...nodeTypes, marketingEdit: MarketingEditNode };

function MarketingCanvasContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const { fitView } = useReactFlow();
  const { running, run, reset } = useMarketingSim(nodes, edges, setEdges);

  const takesTrueBranch = amount > THRESHOLD;

  const selectEdges = useCallback(
    (node: Node, outgoing: Edge[]) => {
      if (node.type === "if") {
        const handle = takesTrueBranch ? "true" : "false";
        return outgoing.filter((e) => e.sourceHandle === handle);
      }
      return outgoing;
    },
    [takesTrueBranch],
  );

  const handleRun = () => {
    if (!running) void run(selectEdges);
  };

  const handleReset = () => {
    reset();
    setAmount(DEFAULT_AMOUNT);
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 0);
  };

  const demoState = useMemo(() => ({ amount, setAmount, running }), [amount, running]);

  return (
    <MarketingDemoProvider value={demoState}>
      <div className="w-full h-full relative bg-card/50 rounded-xl overflow-hidden border border-border shadow-2xl">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={demoNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          nodesDraggable={true}
          nodesConnectable={false}
          style={{ background: "transparent" }}
        >
          <Background color="#CCCCCC" gap={30} size={1} />
        </ReactFlow>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRun}
            disabled={running}
            className={cn(
              "rounded-full border-border bg-card/80 backdrop-blur hover:bg-muted transition-all",
              running && "border-green-500/50 text-green-500 bg-green-500/10",
            )}
          >
            <Play className={cn("w-3 h-3 mr-2", running && "fill-current")} />
            {running ? "Running..." : "Run Simulation"}
          </Button>
        </div>

        <div className="absolute bottom-6 right-6 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="rounded-full border-border bg-card/80 backdrop-blur hover:bg-muted transition-all"
          >
            <RotateCcw className="w-3 h-3 mr-2" />
            Reset
          </Button>
        </div>

        <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none rounded-xl" />
      </div>
    </MarketingDemoProvider>
  );
}

export function MarketingCanvas() {
  return (
    <ReactFlowProvider>
      <ExecutionProvider>
        <MarketingCanvasContent />
      </ExecutionProvider>
    </ReactFlowProvider>
  );
}
