export const MERGE_BRANCH_HANDLE_PREFIX = "merge-branch-";

export function mergeBranchHandleId(index: number): string {
  return `${MERGE_BRANCH_HANDLE_PREFIX}${index}`;
}

export function mergeBranchLabelFromId(
  handleId: string | undefined | null,
): string | undefined {
  if (!handleId) return undefined;
  if (handleId.startsWith(MERGE_BRANCH_HANDLE_PREFIX)) {
    const idx = Number(handleId.replace(MERGE_BRANCH_HANDLE_PREFIX, ""));
    if (Number.isInteger(idx)) {
      return `branch ${idx + 1}`;
    }
  }
  return handleId;
}

export function mergeBranchHandleIdFromLabel(
  label: string | undefined | null,
): string | null {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  const branchMatch = normalized.match(/^branch\s+(\d+)$/);
  if (branchMatch) {
    const idx = Number(branchMatch[1]) - 1;
    if (Number.isInteger(idx) && idx >= 0) {
      return mergeBranchHandleId(idx);
    }
  }
  if (normalized.startsWith(MERGE_BRANCH_HANDLE_PREFIX)) {
    return label;
  }
  return null;
}
