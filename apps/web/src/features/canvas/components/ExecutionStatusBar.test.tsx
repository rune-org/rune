import { describe, expect, it, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";

import { act, fireEvent, render, screen } from "@/test/render";
import { initialExecutionState, type ExecutionState } from "../types/execution";
import { ExecutionStatusBar } from "./ExecutionStatusBar";

const executionState = vi.hoisted(() => ({
  state: initialExecutionState,
}));

vi.mock("../context/ExecutionContext", () => ({
  useExecution: () => ({ state: executionState.state }),
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("ExecutionStatusBar", () => {
  it("shows reconnecting state with live node progress and halt option", async () => {
    const onDismissRunning = vi.fn();
    const user = userEvent.setup();

    executionState.state = {
      ...initialExecutionState,
      executionId: "exec-abcdef123",
      workflowId: 12,
      status: "running",
      nodes: new Map([
        ["trigger", { nodeId: "trigger", status: "success" }],
        ["http", { nodeId: "http", status: "running" }],
        ["log", { nodeId: "log", status: "failed" }],
      ]),
    };

    render(
      <ExecutionStatusBar
        wsStatus="reconnecting"
        wsReconnectAttempts={2}
        onDismissRunning={onDismissRunning}
      />,
    );

    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
    expect(
      screen.getByLabelText("2 of 3 nodes completed, 1 currently running"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Execution ID: exec-abcdef123")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss live execution status" }));
    expect(onDismissRunning).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses completed status after the grace period", () => {
    vi.useFakeTimers();

    executionState.state = {
      ...initialExecutionState,
      executionId: "exec-done",
      workflowId: 12,
      status: "completed",
      totalDurationMs: 450,
      nodes: new Map(),
    };

    render(<ExecutionStatusBar wsStatus="connected" />);
    expect(screen.getByText("Completed in 450ms")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5300);
    });

    expect(screen.queryByText("Completed in 450ms")).not.toBeInTheDocument();
  });

  it("shows failure reason and supports manual dismissal", () => {
    vi.useFakeTimers();

    executionState.state = {
      ...initialExecutionState,
      executionId: "exec-fail",
      workflowId: 12,
      status: "failed",
      error: "Workflow timed out",
      nodes: new Map(),
    };

    render(<ExecutionStatusBar wsStatus="connected" />);
    expect(screen.getByText("Workflow timed out")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss status notification" }));
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText("Workflow timed out")).not.toBeInTheDocument();
  });

  it("shows live-status-unavailable banner and halt affordance after repeated websocket failures", async () => {
    const onDismissRunning = vi.fn();
    const user = userEvent.setup();

    executionState.state = {
      ...initialExecutionState,
      executionId: "exec-live-fallback",
      workflowId: 12,
      status: "running",
      nodes: new Map([["http", { nodeId: "http", status: "running" }]]),
    };

    render(
      <ExecutionStatusBar
        wsStatus="error"
        wsReconnectAttempts={3}
        onDismissRunning={onDismissRunning}
      />,
    );

    expect(screen.getByText("Execution started; live status unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss live execution status" }));
    expect(onDismissRunning).toHaveBeenCalledTimes(1);
  });

  it("renders halted status and dismisses after timeout", () => {
    vi.useFakeTimers();

    executionState.state = {
      ...initialExecutionState,
      executionId: "exec-halted",
      workflowId: 12,
      status: "halted",
      nodes: new Map(),
    };

    render(<ExecutionStatusBar wsStatus="connected" />);
    expect(screen.getByText("Workflow halted")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5300);
    });

    expect(screen.queryByText("Workflow halted")).not.toBeInTheDocument();
  });
});
