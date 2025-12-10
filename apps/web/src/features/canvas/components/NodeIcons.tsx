"use client";

import { Bot, Globe, Mail, Play, GitBranch, Clock } from "lucide-react";
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
    default:
      return Play;
  }
}
