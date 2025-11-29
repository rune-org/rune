export const SWITCH_RULE_HANDLE_PREFIX = "switch-case-";
export const SWITCH_FALLBACK_HANDLE_ID = "switch-fallback";

export function switchRuleHandleId(index: number): string {
  return `${SWITCH_RULE_HANDLE_PREFIX}${index}`;
}

export function switchFallbackHandleId(): string {
  return SWITCH_FALLBACK_HANDLE_ID;
}

export function switchHandleLabelFromId(handleId: string | undefined | null): string | undefined {
  if (!handleId) return undefined;
  if (handleId === SWITCH_FALLBACK_HANDLE_ID) return "fallback";
  if (handleId.startsWith(SWITCH_RULE_HANDLE_PREFIX)) {
    const idx = Number(handleId.replace(SWITCH_RULE_HANDLE_PREFIX, ""));
    if (Number.isInteger(idx)) {
      return `case ${idx + 1}`;
    }
  }
  return handleId;
}

export function switchHandleIdFromLabel(label: string | undefined | null): string | null {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  if (normalized === "fallback") return SWITCH_FALLBACK_HANDLE_ID;
  const caseMatch = normalized.match(/^case\s+(\d+)$/);
  if (caseMatch) {
    const idx = Number(caseMatch[1]) - 1;
    if (Number.isInteger(idx) && idx >= 0) {
      return switchRuleHandleId(idx);
    }
  }
  if (normalized.startsWith(SWITCH_RULE_HANDLE_PREFIX)) {
    return label;
  }
  return null;
}
