"use client";

import {
  Bot,
  Clock,
  Combine,
  GitBranch,
  Globe,
  Layers,
  Mail,
  Pencil,
  Play,
  Split,
} from "lucide-react";
import type { NodeKind } from "../types";

export function iconFor(kind: NodeKind) {
  switch (kind) {
    case "trigger":
      return Play;
    case "scheduled":
      return Clock;
    case "agent":
      return Bot;
    case "if":
    case "switch":
      return GitBranch;
    case "http":
      return Globe;
    case "smtp":
      return Mail;
    case "wait":
      return Clock;
    case "edit":
      return Pencil;
    case "split":
      return Split;
    case "aggregator":
      return Layers;
    case "merge":
      return Combine;
    default:
      return Play;
  }
}
