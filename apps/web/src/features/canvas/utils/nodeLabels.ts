export function sanitizeNodeLabel(raw: string, fallback = ""): string {
  if (!raw.trim()) return fallback;

  let sanitized = raw
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[-0-9]+/, "");

  if (!sanitized) {
    sanitized = fallback;
  }

  if (sanitized && !/^[a-zA-Z_]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  return sanitized;
}
