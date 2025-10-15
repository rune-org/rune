// Mock API service returning hardcoded JSON data.
// This service should be swapped out later with the real API client.

import type {
  ExecutionHistoryItem,
  TemplateSummary,
  UserProfile,
} from "./workflow-dsl";
import type { CanvasEdge, CanvasNode } from "@/features/canvas/types";

export type WorkflowStatus = "active" | "disabled" | "draft";
export type TriggerType = "Scheduled" | "Webhook" | "Manual";

export interface WorkflowSummary {
  id: string;
  name: string;
  triggerType: TriggerType;
  status: WorkflowStatus;
  lastRunAt: string | null;
  lastRunStatus: "success" | "failed" | "running" | "n/a";
  runs: number;
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const MS_LATENCY = 120;

// Example workflow summaries for workflow list view
const workflowSummaries: WorkflowSummary[] = [
  {
    id: "wf-email-slack",
    name: "Email to Slack",
    triggerType: "Scheduled",
    status: "active",
    lastRunAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    lastRunStatus: "success",
    runs: 15,
  },
  {
    id: "wf-weather-update",
    name: "Weather Update",
    triggerType: "Webhook",
    status: "disabled",
    lastRunAt: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
    lastRunStatus: "success",
    runs: 8,
  },
  {
    id: "wf-data-backup",
    name: "Data Backup",
    triggerType: "Manual",
    status: "draft",
    lastRunAt: null,
    lastRunStatus: "n/a",
    runs: 0,
  },
];

// Minimal sample graphs
const workflowGraphs: Record<
  string,
  { nodes: CanvasNode[]; edges: CanvasEdge[] }
> = {
  "wf-email-slack": {
    nodes: [
      {
        id: "trgr-1",
        type: "trigger",
        position: { x: 100, y: 120 },
        data: { label: "Start" },
      },
      {
        id: "http-1",
        type: "http",
        position: { x: 340, y: 120 },
        data: { label: "Fetch" },
      },
      {
        id: "smtp-1",
        type: "smtp",
        position: { x: 580, y: 120 },
        data: { label: "Notify" },
      },
    ],
    edges: [
      { id: "e1", source: "trgr-1", target: "http-1", type: "default" },
      { id: "e2", source: "http-1", target: "smtp-1", type: "default" },
    ],
  },
  "wf-weather-update": {
    nodes: [
      {
        id: "trgr-2",
        type: "trigger",
        position: { x: 100, y: 160 },
        data: { label: "Webhook" },
      },
      {
        id: "if-2",
        type: "if",
        position: { x: 360, y: 160 },
        data: { label: "Check" },
      },
    ],
    edges: [{ id: "e3", source: "trgr-2", target: "if-2", type: "default" }],
  },
  "wf-data-backup": {
    nodes: [
      {
        id: "trgr-3",
        type: "trigger",
        position: { x: 120, y: 120 },
        data: { label: "Manual" },
      },
    ],
    edges: [],
  },
};

const templates: TemplateSummary[] = [
  {
    id: "tmpl-1",
    title: "Report Monitor",
    description: "Poll an API and alert on failure",
    from: "HTTP",
    to: "SMTP",
  },
  {
    id: "tmpl-2",
    title: "User Onboarding",
    description: "Send a welcome email to new signups",
    from: "Manual",
    to: "SMTP",
  },
];

const executions: ExecutionHistoryItem[] = [
  {
    id: "exe-1001",
    workflowId: "report_processor_002",
    status: "success",
    startedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    finishedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "exe-1002",
    workflowId: "welcome_mailer_001",
    status: "failed",
    startedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    finishedAt: new Date(Date.now() - 1000 * 60 * 19).toISOString(),
  },
];

const user: UserProfile = {
  id: "user-001",
  name: "Demo User",
  email: "demo@rune.local",
  avatarUrl: undefined,
};

export const ApiMock = {
  async getUserProfile(): Promise<UserProfile> {
    await delay(MS_LATENCY);
    return user;
  },
  async getWorkflows(): Promise<WorkflowSummary[]> {
    await delay(MS_LATENCY);
    return workflowSummaries;
  },
  async getWorkflowGraph(
    id: string,
  ): Promise<{ nodes: CanvasNode[]; edges: CanvasEdge[] }> {
    await delay(MS_LATENCY);
    return workflowGraphs[id] ?? { nodes: [], edges: [] };
  },
  // TODO: This should call a backend endpoint
  // e.g. PUT /workflows/:id/graph with a validated RF JSON payload.
  async saveWorkflowGraph(
    id: string,
    graph: { nodes: CanvasNode[]; edges: CanvasEdge[] },
  ): Promise<void> {
    await delay(MS_LATENCY);
    workflowGraphs[id] = graph;
  },
  // TODO: This should be a POST /workflows returning
  // { id, name, status, triggerType, ... } and probably a separate POST for graph.
  async createWorkflow(payload: {
    name: string;
    triggerType: TriggerType;
  }): Promise<WorkflowSummary> {
    await delay(MS_LATENCY);
    const id = `wf-${Math.random().toString(36).slice(2, 9)}`;
    const summary: WorkflowSummary = {
      id,
      name: payload.name || "Untitled Workflow",
      triggerType: payload.triggerType || "Manual",
      status: "draft",
      lastRunAt: null,
      lastRunStatus: "n/a",
      runs: 0,
    };
    workflowSummaries.unshift(summary);
    workflowGraphs[id] = { nodes: [], edges: [] };
    return summary;
  },
  async getTemplates(): Promise<TemplateSummary[]> {
    await delay(MS_LATENCY);
    return templates;
  },
  async getExecutionHistory(): Promise<ExecutionHistoryItem[]> {
    await delay(MS_LATENCY);
    return executions;
  },
  async setWorkflowActive(id: string, active: boolean): Promise<void> {
    await delay(MS_LATENCY);
    const wf = workflowSummaries.find((w) => w.id === id);
    if (wf) wf.status = active ? "active" : "disabled";
  },
  // TODO: This should be DELETE /workflows/:id
  async deleteWorkflow(id: string): Promise<void> {
    await delay(MS_LATENCY);
    const idx = workflowSummaries.findIndex((w) => w.id === id);
    if (idx >= 0) workflowSummaries.splice(idx, 1);
    if (workflowGraphs[id]) delete workflowGraphs[id];
  },
};

export type ApiMockType = typeof ApiMock;
