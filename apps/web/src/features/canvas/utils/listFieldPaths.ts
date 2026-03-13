function withDollarRoot(path: string): string {
  if (!path || path.startsWith("$")) return path;
  return `$${path}`;
}

export function normalizeListItemFieldPath(
  inputArray: string | undefined,
  field: string | undefined,
): string {
  const rawField = field?.trim() ?? "";
  if (!rawField) return "";
  if (rawField.startsWith("$item.")) {
    return rawField.slice("$item.".length);
  }

  const inputRef = inputArray?.trim();
  if (!inputRef) return rawField;

  const base = withDollarRoot(inputRef);
  const fullField = withDollarRoot(rawField);

  if (fullField.startsWith(`${base}[`)) {
    const remainder = fullField.slice(base.length);
    const closeIdx = remainder.indexOf("]");
    if (closeIdx >= 0 && remainder[closeIdx + 1] === ".") {
      return remainder.slice(closeIdx + 2);
    }
  }

  if (fullField.startsWith(`${base}.`)) {
    return fullField.slice(base.length + 1);
  }

  return rawField;
}

export function toListItemSelection(
  inputArray: string | undefined,
  selectedPath: string,
): string {
  const rawPath = selectedPath.trim();
  if (!rawPath) return rawPath;
  if (rawPath === "$item" || rawPath.startsWith("$item.")) {
    return rawPath;
  }

  const normalized = normalizeListItemFieldPath(inputArray, rawPath);
  if (normalized !== rawPath) {
    return normalized ? `$item.${normalized}` : "$item";
  }

  // if inputArray is blank and normalization couldn't strip a prefix, detect
  // an array index pattern like $Node.field[0].subfield and extract the
  // item-relative field after the index.
  const arrayItemMatch = rawPath.match(/\[\d+\]\.(.+)$/);
  if (arrayItemMatch?.[1]) {
    return `$item.${arrayItemMatch[1]}`;
  }
  if (/\[\d+\]$/.test(rawPath)) {
    return "$item";
  }

  return rawPath;
}

export function toArraySelection(selectedPath: string): string {
  const rawPath = selectedPath.trim();
  if (!rawPath) return rawPath;

  const arraySampleMatch = rawPath.match(/^(.*)\[\d+\](?:\..+)?$/);
  if (arraySampleMatch?.[1]) {
    return arraySampleMatch[1];
  }

  return rawPath;
}
