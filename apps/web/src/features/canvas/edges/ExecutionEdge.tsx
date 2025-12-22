"use client";

import { SmoothStepEdge, type EdgeProps } from "@xyflow/react";

export function ExecutionEdge(props: EdgeProps) {
  const pathOptions = {
    ...(props.data?.pathOptions as Record<string, unknown> | undefined),
    borderRadius: 16,
  };

  return <SmoothStepEdge {...props} pathOptions={pathOptions} />;
}

export default ExecutionEdge;
