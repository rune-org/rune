"use client";

import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "@/features/canvas/nodes"; 
import "@/features/canvas/styles/reactflow.css";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

const INITIAL_NODES = [
  {
    id: "trgr-1",
    type: "trigger",
    position: { x: 50, y: 100 },
    data: { label: "Webhook" },
  },
  {
    id: "if-1",
    type: "if",
    position: { x: 300, y: 100 },
    data: { label: "Is High Value?", expression: "payload.amount > 1000" },
  },
  {
    id: "smtp-1",
    type: "smtp",
    position: { x: 600, y: 0 },
    data: {
      label: "Send VIP Email",
      to: "sales@company.com",
      subject: "High-Value Customer Alert",
      credential: {
        type: "smtp",
        id: "mock-smtp-1",
        name: "Company SMTP"
      }
    },
  },
  {
    id: "http-1",
    type: "http",
    position: { x: 600, y: 200 },
    data: { label: "Post to Slack", method: "POST", url: "https://hooks.slack.com/..." },
  },
];

const INITIAL_EDGES = [
  { id: "edge-1", source: "trgr-1", target: "if-1", type: "default", animated: true, style: { stroke: "#52525b" } },
  {
    id: "edge-2",
    source: "if-1",
    target: "smtp-1",
    type: "default",
    sourceHandle: "true",
    animated: true,
    label: "true",
    labelStyle: { fill: "white", fontWeight: 600 },
    labelShowBg: true,
    labelBgStyle: { fill: "hsl(142 70% 45%)" },
    labelBgPadding: [2, 6] as [number, number],
    labelBgBorderRadius: 4,
    style: { stroke: "#52525b" }
  },
  {
    id: "edge-3",
    source: "if-1",
    target: "http-1",
    type: "default",
    sourceHandle: "false",
    animated: true,
    label: "false",
    labelStyle: { fill: "white", fontWeight: 600 },
    labelShowBg: true,
    labelBgStyle: { fill: "hsl(0 70% 50%)" },
    labelBgPadding: [2, 6] as [number, number],
    labelBgBorderRadius: 4,
    style: { stroke: "#52525b" }
  },
];

function MarketingCanvasContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const { fitView } = useReactFlow();

  const handleReset = () => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 0);
  };

  return (
    <div className="w-full h-full relative bg-zinc/50 rounded-xl overflow-hidden border-1 border-white/10 shadow-2xl">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        nodesDraggable={true}
        nodesConnectable={false}
        style={{ background: 'transparent' }}
      >
        <Background color="#CCCCCC" gap={30} size={1} />
      </ReactFlow>
      
      {/* TODO: maybe add a simulation effect for the canvas component if possile */}
      {/* <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsSimulating(!isSimulating)}
          className={cn(
            "rounded-full border-white/10 bg-zinc-900/80 backdrop-blur hover:bg-zinc-800 transition-all",
            isSimulating && "border-green-500/50 text-green-400 bg-green-500/10"
          )}
        >
          <Play className={cn("w-3 h-3 mr-2", isSimulating && "fill-current")} />
          {isSimulating ? "Simulating Live Traffic..." : "Run Simulation"}
        </Button>
      </div> */}

      <div className="absolute bottom-6 right-6 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="rounded-full border-white/10 bg-zinc-900/80 backdrop-blur hover:bg-zinc-800 transition-all"
        >
          <RotateCcw className="w-3 h-3 mr-2" />
          Reset
        </Button>
      </div>

      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-xl" />
    </div>
  );
}

export function MarketingCanvas() {
  return (
    <ReactFlowProvider>
      <MarketingCanvasContent />
    </ReactFlowProvider>
  );
}