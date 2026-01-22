import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import type { NodeExecutionStatus } from "../types/execution";

/**
 * Status indicator component for node execution state.
 * Displays a badge in the top-right corner of a node showing its current status.
 */
export function StatusIndicator({ status }: { status: NodeExecutionStatus }) {
  switch (status) {
    case "running":
      return (
        <div
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white shadow-md z-10"
          title="Running"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </div>
      );
    case "success":
      return (
        <div
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white shadow-md z-10"
          title="Success"
        >
          <CheckCircle className="h-3.5 w-3.5" />
        </div>
      );
    case "failed":
      return (
        <div
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md z-10"
          title="Failed"
        >
          <XCircle className="h-3.5 w-3.5" />
        </div>
      );
    case "waiting":
      return (
        <div
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-white shadow-md z-10"
          title="Waiting"
        >
          <Clock className="h-3.5 w-3.5" />
        </div>
      );
    default:
      return null;
  }
}
