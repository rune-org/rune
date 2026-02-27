import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "../types";
import { sanitizeGraph, stringifyGraph, stripExecutionStyling } from "../lib/graphIO";
import { workflowDataToCanvas } from "@/lib/workflow-dsl";
import { toast } from "@/components/ui/toast";
import { createId } from "../utils/id";

const CLIPBOARD_SELECTION_TYPE = "rune.canvas.selection";
const PASTE_OFFSET = 32;

export type UseGraphClipboardOptions = {
  nodes: CanvasNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  pushHistory: () => void;
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setSelectedNodeId: (id: string | null) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

function notifyPasteShortcut() {
  toast("Press Ctrl+V (or Cmd+V) to paste workflow from clipboard");
}

export function useGraphClipboard(opts: UseGraphClipboardOptions) {
  const {
    nodes,
    edges,
    selectedNodeId,
    pushHistory,
    setNodes,
    setEdges,
    setSelectedNodeId,
    containerRef,
  } = opts;

  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [isImportTemplateOpen, setIsImportTemplateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const selectedNodeIdRef = useRef(selectedNodeId);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    selectedNodeIdRef.current = selectedNodeId;
  }, [nodes, edges, selectedNodeId]);

  const copySelection = useCallback(async () => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const currentSelectedNodeId = selectedNodeIdRef.current;

    const selectedNodeIds = new Set(
      currentNodes.filter((n) => n.selected).map((n) => n.id),
    );
    if (selectedNodeIds.size === 0 && currentSelectedNodeId) {
      selectedNodeIds.add(currentSelectedNodeId);
    }

    if (selectedNodeIds.size === 0) {
      return;
    }

    const selectedNodes = currentNodes
      .filter((n) => selectedNodeIds.has(n.id))
      .map((n) => structuredClone(n));

    const selectedEdges = currentEdges
      .filter(
        (e) =>
          selectedNodeIds.has(e.source) &&
          selectedNodeIds.has(e.target),
      )
      .map((e) => structuredClone(e));

    if (!navigator.clipboard?.writeText) {
      toast.error("Clipboard permissions are required to copy");
      return;
    }

    const cleaned = stripExecutionStyling({ nodes: selectedNodes, edges: selectedEdges });
    const payload = {
      __runeClipboardType: CLIPBOARD_SELECTION_TYPE,
      nodes: cleaned.nodes,
      edges: cleaned.edges,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success("Copied selection to clipboard");
    } catch {
      toast.error("Unable to copy selection");
    }
  }, []);

  const exportToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        stringifyGraph({ nodes: nodesRef.current, edges: edgesRef.current })
      );
      toast.success("Exported JSON to clipboard");
    } catch {
      toast.error("Failed to export JSON to clipboard");
    }
  }, []);

  const exportToFile = useCallback(() => {
    const json = stringifyGraph({
      nodes: nodesRef.current,
      edges: edgesRef.current,
    });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Exported workflow to file");
  }, []);

  const exportToTemplate = useCallback(() => {
    if (nodesRef.current.length === 0) {
      toast.error("Cannot save empty workflow as template");
      return;
    }
    setIsSaveTemplateOpen(true);
  }, []);

  const importFromFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const raw = JSON.parse(text);
          if (!raw || typeof raw !== "object") {
            toast.error("Invalid workflow data");
            return;
          }
          const candidate = raw as { nodes?: unknown; edges?: unknown };
          if (
            !Array.isArray(candidate.nodes) ||
            !Array.isArray(candidate.edges)
          ) {
            toast.error("Invalid workflow format");
            return;
          }
          const parsed = sanitizeGraph({
            nodes: candidate.nodes as CanvasNode[],
            edges: candidate.edges as Edge[],
          });
          if (parsed.nodes.length === 0) {
            toast.error("No valid nodes found in file");
            return;
          }
          pushHistory();
          setNodes(parsed.nodes as CanvasNode[]);
          setEdges(parsed.edges as Edge[]);
          toast.success(`Imported workflow from ${file.name}`);
        } catch {
          toast.error("Failed to parse workflow file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [pushHistory, setNodes, setEdges],
  );

  const importFromTemplate = useCallback(() => {
    setIsImportTemplateOpen(true);
  }, []);

  const handleTemplateSelect = useCallback(
    (workflowData: { nodes: CanvasNode[]; edges: Edge[] }) => {
      const parsed = sanitizeGraph(workflowData);
      pushHistory();
      setNodes(parsed.nodes as CanvasNode[]);
      setEdges(parsed.edges as Edge[]);
      setIsImportTemplateOpen(false);
      toast.success("Imported workflow from template");
    },
    [pushHistory, setNodes, setEdges],
  );

  // Paste to import graph DSL or clone selections
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      // Ignore paste events from dialogs (e.g., expanded inspector)
      const target = e.target as HTMLElement | null;
      if (target?.closest('[role="dialog"]')) return;

      const text = e.clipboardData?.getData("text");
      if (!text) return;
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return;
      }

      if (!raw || typeof raw !== "object") return;

      const candidate = raw as {
        __runeClipboardType?: string;
        nodes?: unknown[];
        edges?: unknown[];
      };

      if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) {
        return;
      }

      const clipboardType = candidate.__runeClipboardType ?? null;

      // Detect worker DSL format
      const isWorkerDSL = candidate.edges.some(
        (e) => e && typeof e === "object" && "src" in e && "dst" in e
      );

      // Convert worker DSL to canvas
      const graphData = isWorkerDSL
        ? workflowDataToCanvas({
            nodes: candidate.nodes as Parameters<typeof workflowDataToCanvas>[0]["nodes"],
            edges: candidate.edges as Parameters<typeof workflowDataToCanvas>[0]["edges"],
          })
        : { nodes: candidate.nodes as CanvasNode[], edges: candidate.edges as Edge[] };

      const parsed = sanitizeGraph(graphData);

      // For DSL imports, ignore if parsed graph is empty to prevent
      // accidentally clearing the canvas.
      if (clipboardType !== CLIPBOARD_SELECTION_TYPE && parsed.nodes.length === 0) {
        return;
      }

      if (clipboardType === CLIPBOARD_SELECTION_TYPE) {
        e.preventDefault();
        pushHistory();

        const idMap = new Map<string, string>();
        const pastedNodes = (parsed.nodes as CanvasNode[]).map((node) => {
          const newId = createId();
          idMap.set(node.id, newId);
          return {
            ...node,
            id: newId,
            selected: true,
            position: {
              x: (node.position?.x ?? 0) + PASTE_OFFSET,
              y: (node.position?.y ?? 0) + PASTE_OFFSET,
            },
          } satisfies CanvasNode;
        });

        const pastedEdges = (parsed.edges as Edge[])
          .map((edge) => {
            const newSource = idMap.get(edge.source);
            const newTarget = idMap.get(edge.target);
            if (!newSource || !newTarget) return null;
            return {
              ...edge,
              id: createId(),
              source: newSource,
              target: newTarget,
            } satisfies Edge;
          })
          .filter((edge): edge is Edge => edge !== null);

        setNodes((current) => [
          ...current.map((n) => ({ ...n, selected: false })),
          ...pastedNodes,
        ]);
        setEdges((current) => [...current, ...pastedEdges]);
        setSelectedNodeId(pastedNodes[0]?.id ?? null);
        toast.success("Pasted selection from clipboard");
        return;
      }

      e.preventDefault();
      pushHistory();
      setNodes(parsed.nodes as CanvasNode[]);
      setEdges(parsed.edges as Edge[]);
      toast.success("Imported workflow from clipboard");
    };
    const el = containerRef.current ?? window;
    el.addEventListener("paste", handler as EventListener);
    return () => el.removeEventListener("paste", handler as EventListener);
  }, [pushHistory, setEdges, setNodes, setSelectedNodeId, containerRef]);

  return {
    copySelection,
    exportToClipboard,
    exportToFile,
    exportToTemplate,
    importFromClipboard: notifyPasteShortcut,
    importFromFile,
    handleFileImport,
    importFromTemplate,
    handleTemplateSelect,
    isSaveTemplateOpen,
    setIsSaveTemplateOpen,
    isImportTemplateOpen,
    setIsImportTemplateOpen,
    fileInputRef,
  };
}
