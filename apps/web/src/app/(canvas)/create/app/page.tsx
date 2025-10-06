"use client";

import FlowCanvas from "@/features/canvas/FlowCanvas";

export default function CanvasPage() {
  return (
    <div className="flex h-[100vh] flex-col">
      <div className="flex-1">
        <FlowCanvas />
      </div>
    </div>
  );
}
