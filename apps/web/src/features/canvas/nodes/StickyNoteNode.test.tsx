import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import type { StickyNoteData } from "../types";

const { updateNodeData } = vi.hoisted(() => ({ updateNodeData: vi.fn() }));

vi.mock("@xyflow/react", () => ({
  NodeResizer: () => null,
  useReactFlow: () => ({ updateNodeData }),
}));

import { StickyNoteNode } from "./StickyNoteNode";

function renderNote(data: Partial<StickyNoteData>, opts?: { selected?: boolean }) {
  const props = {
    id: "note-1",
    type: "stickyNote",
    data: { content: "", ...data },
    selected: opts?.selected ?? false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    deletable: true,
    selectable: true,
    draggable: true,
  } as unknown as Parameters<typeof StickyNoteNode>[0];
  return render(<StickyNoteNode {...props} />);
}

describe("StickyNoteNode", () => {
  beforeEach(() => updateNodeData.mockClear());

  it("renders markdown content", () => {
    renderNote({ content: "**bold note**" });
    const strong = screen.getByText("bold note");
    expect(strong.tagName.toLowerCase()).toBe("strong");
  });

  it("shows a placeholder when empty", () => {
    renderNote({ content: "" });
    expect(screen.getByText(/double-click to edit/i)).toBeInTheDocument();
  });

  it("enters edit mode on double-click and exposes the raw markdown", () => {
    renderNote({ content: "raw **md**" });
    fireEvent.doubleClick(screen.getByText("md").closest("div")!);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("raw **md**");
  });

  it("commits edited content on blur", () => {
    renderNote({ content: "before" });
    fireEvent.doubleClick(screen.getByText("before").closest("div")!);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "after" } });
    fireEvent.blur(textarea);
    expect(updateNodeData).toHaveBeenCalledWith("note-1", { content: "after" });
  });

  it("changes color via the in-note swatches when selected", () => {
    renderNote({ content: "x", color: "yellow" }, { selected: true });
    fireEvent.click(screen.getByLabelText("Color green"));
    expect(updateNodeData).toHaveBeenCalledWith("note-1", { color: "green" });
  });

  it("changes font size via the in-note controls when selected", () => {
    renderNote({ content: "x", fontSize: "md" }, { selected: true });
    fireEvent.click(screen.getByLabelText("Font size lg"));
    expect(updateNodeData).toHaveBeenCalledWith("note-1", { fontSize: "lg" });
  });

  it("hides the controls when not selected", () => {
    renderNote({ content: "x", color: "yellow" }, { selected: false });
    expect(screen.queryByLabelText("Color green")).not.toBeInTheDocument();
  });
});
