"use client";

import { useState, useCallback, useRef, useMemo } from "react";

/** Regex matching Go resolver's $ notation: $nodeName or $nodeName.field.path */
const VARIABLE_REGEX = /\$([a-zA-Z_][a-zA-Z0-9_-]*)(?:\.([a-zA-Z0-9_\[\]\.\-]+))?/g;

export type VariableMatch = {
  full: string;
  nodeName: string;
  fieldPath: string | undefined;
  start: number;
  end: number;
};

const ZERO_WIDTH_CHAR_REGEX = /[\u200B\uFEFF]/g;

function normalizeRawText(text: string): string {
  return text.replace(ZERO_WIDTH_CHAR_REGEX, "").replace(/\u00A0/g, " ");
}

function isBlockElement(node: Node): node is HTMLElement {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = (node as HTMLElement).tagName;
  return tag === "DIV" || tag === "P";
}

function isPlaceholderBlock(element: HTMLElement): boolean {
  if (!isBlockElement(element)) return false;
  if (element.childNodes.length !== 1) return false;
  const first = element.firstChild;
  return (
    first?.nodeType === Node.ELEMENT_NODE &&
    (first as HTMLElement).tagName === "BR"
  );
}

function blockPrefixLength(child: Node, childIndex: number): number {
  return childIndex > 0 && isBlockElement(child) ? 1 : 0;
}

function rawLengthOfTextPrefix(text: string, endOffset: number): number {
  const safeEnd = Math.max(0, Math.min(endOffset, text.length));
  let length = 0;
  for (let i = 0; i < safeEnd; i++) {
    const ch = text[i];
    if (ch === "\u200B" || ch === "\uFEFF") continue;
    length += 1;
  }
  return length;
}

function domOffsetFromRawTextOffset(text: string, rawOffset: number): number {
  const target = Math.max(0, rawOffset);
  if (target === 0) return 0;

  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\u200B" || ch === "\uFEFF") continue;
    seen += 1;
    if (seen >= target) {
      return i + 1;
    }
  }

  return text.length;
}

function getRawLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeRawText(node.textContent ?? "").length;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return 0;
  }

  const element = node as HTMLElement;
  const dataValue = element.getAttribute("data-value");
  if (dataValue) return dataValue.length;

  if (element.tagName === "BR") return 1;
  if (isPlaceholderBlock(element)) return 0;

  let length = 0;
  const children = Array.from(element.childNodes);
  for (let i = 0; i < children.length; i++) {
    length += blockPrefixLength(children[i], i);
    length += getRawLength(children[i]);
  }

  return length;
}

function nodeContainsTarget(node: Node, target: Node): boolean {
  if (node === target) return true;
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return (node as Element).contains(target);
}

function countRawAtElementBoundary(element: HTMLElement, boundaryOffset: number): number {
  const children = Array.from(element.childNodes);
  const safeBoundary = Math.max(0, Math.min(boundaryOffset, children.length));
  let total = 0;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const prefix = blockPrefixLength(child, i);

    if (i === safeBoundary) {
      return total + prefix;
    }

    total += prefix;
    total += getRawLength(child);
  }

  return total;
}

function countRawOffsetWithinNode(
  node: Node,
  targetNode: Node,
  targetOffset: number,
): number | null {
  if (node === targetNode) {
    if (node.nodeType === Node.TEXT_NODE) {
      return rawLengthOfTextPrefix(node.textContent ?? "", targetOffset);
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const dataValue = element.getAttribute("data-value");
      if (dataValue) {
        return targetOffset > 0 ? dataValue.length : 0;
      }
      if (element.tagName === "BR") {
        return targetOffset > 0 ? 1 : 0;
      }
      if (isPlaceholderBlock(element)) {
        return 0;
      }
      return countRawAtElementBoundary(element, targetOffset);
    }

    return 0;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  if (
    element.getAttribute("data-value") ||
    element.tagName === "BR" ||
    isPlaceholderBlock(element)
  ) {
    return null;
  }

  let total = 0;
  const children = Array.from(element.childNodes);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const prefix = blockPrefixLength(child, i);

    if (nodeContainsTarget(child, targetNode)) {
      total += prefix;
      const nested = countRawOffsetWithinNode(child, targetNode, targetOffset);
      return nested === null ? total : total + nested;
    }

    total += prefix;
    total += getRawLength(child);
  }

  return null;
}

type CursorDomPosition = {
  container: Node;
  offset: number;
};

function parentOffsetForNode(node: Node, after: boolean): CursorDomPosition | null {
  const parent = node.parentNode;
  if (!parent) return null;

  const index = Array.prototype.indexOf.call(parent.childNodes, node);
  if (index < 0) return null;

  return { container: parent, offset: after ? index + 1 : index };
}

function resolveCursorPosition(
  node: Node,
  rawOffset: number,
): CursorDomPosition {
  const safeOffset = Math.max(0, rawOffset);

  if (node.nodeType === Node.TEXT_NODE) {
    return {
      container: node,
      offset: domOffsetFromRawTextOffset(node.textContent ?? "", safeOffset),
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return { container: node, offset: 0 };
  }

  const element = node as HTMLElement;
  const dataValue = element.getAttribute("data-value");
  if (dataValue) {
    return (
      parentOffsetForNode(element, safeOffset > 0) ?? {
        container: element,
        offset: 0,
      }
    );
  }

  if (element.tagName === "BR") {
    return (
      parentOffsetForNode(element, safeOffset > 0) ?? {
        container: element,
        offset: 0,
      }
    );
  }

  if (isPlaceholderBlock(element)) {
    return { container: element, offset: 0 };
  }

  let remaining = safeOffset;
  const children = Array.from(element.childNodes);

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const prefix = blockPrefixLength(child, i);

    if (remaining === 0) {
      return { container: element, offset: i };
    }

    if (prefix > 0) {
      if (remaining <= prefix) {
        return { container: element, offset: i };
      }
      remaining -= prefix;
    }

    const childLength = getRawLength(child);
    if (remaining === 0) {
      return { container: element, offset: i };
    }

    if (remaining < childLength) {
      if (child.nodeType === Node.TEXT_NODE) {
        return resolveCursorPosition(child, remaining);
      }

      if (child.nodeType === Node.ELEMENT_NODE) {
        const childElement = child as HTMLElement;
        if (
          childElement.getAttribute("data-value") ||
          childElement.tagName === "BR" ||
          isPlaceholderBlock(childElement)
        ) {
          return { container: element, offset: i + 1 };
        }
      }

      return resolveCursorPosition(child, remaining);
    }

    if (remaining === childLength) {
      return { container: element, offset: i + 1 };
    }

    remaining -= childLength;
  }

  return { container: element, offset: children.length };
}

function extractFromNode(node: Node, childIndex: number): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeRawText(node.textContent ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const dataValue = element.getAttribute("data-value");
  if (dataValue) {
    return dataValue;
  }

  if (element.tagName === "BR") {
    return "\n";
  }

  const prefix = blockPrefixLength(element, childIndex) ? "\n" : "";
  if (isPlaceholderBlock(element)) {
    return prefix;
  }

  return prefix + extractChildren(element);
}

function extractChildren(el: HTMLElement): string {
  let result = "";
  const children = Array.from(el.childNodes);
  for (let i = 0; i < children.length; i++) {
    result += extractFromNode(children[i], i);
  }
  return result;
}

/**
 * Parse all $references from a string.
 * Skips escaped references: \$ is treated as a literal $.
 */
export function parseVariableReferences(value: string): VariableMatch[] {
  const matches: VariableMatch[] = [];
  let match: RegExpExecArray | null;

  VARIABLE_REGEX.lastIndex = 0;
  while ((match = VARIABLE_REGEX.exec(value)) !== null) {
    // Skip escaped: \$ means literal $, don't treat as variable
    if (match.index > 0 && value[match.index - 1] === "\\") continue;
    matches.push({
      full: match[0],
      nodeName: match[1],
      fieldPath: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return matches;
}

/**
 * Splits a string into segments: alternating text and variable references.
 */
export type Segment =
  | { type: "text"; value: string }
  | { type: "variable"; value: string; nodeName: string; fieldPath?: string };

export function segmentValue(value: string): Segment[] {
  const refs = parseVariableReferences(value);
  if (refs.length === 0) return [{ type: "text", value }];

  const segments: Segment[] = [];
  let lastEnd = 0;

  for (const ref of refs) {
    if (ref.start > lastEnd) {
      segments.push({ type: "text", value: value.slice(lastEnd, ref.start) });
    }
    segments.push({
      type: "variable",
      value: ref.full,
      nodeName: ref.nodeName,
      fieldPath: ref.fieldPath,
    });
    lastEnd = ref.end;
  }

  if (lastEnd < value.length) {
    segments.push({ type: "text", value: value.slice(lastEnd) });
  }

  return segments;
}

type UseVariableInputOptions = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Extract the raw text value from a contentEditable element.
 * Pill spans have a data-value attribute holding the raw $expression.
 * Everything else is plain text.
 */
export function extractValueFromElement(el: HTMLElement): string {
  return extractChildren(el);
}

/**
 * Get the cursor offset in terms of raw value characters.
 * Walks the DOM to map the Selection offset back to our raw string.
 */
function getCursorOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;

  const range = sel.getRangeAt(0);
  if (range.startContainer !== el && !el.contains(range.startContainer)) {
    return -1;
  }

  const offset = countRawOffsetWithinNode(
    el,
    range.startContainer,
    range.startOffset,
  );

  return offset ?? getRawLength(el);
}

export function useVariableInput({ value, onChange }: UseVariableInputOptions) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [autocompleteRange, setAutocompleteRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [autocompleteLeft, setAutocompleteLeft] = useState(0);
  const editableRef = useRef<HTMLDivElement | null>(null);
  // Track whether the last value change came from user typing (internal)
  // vs an external source (picker, parent prop change, etc.)
  const isInternalChangeRef = useRef(false);

  const segments = useMemo(() => segmentValue(value), [value]);

  const handleInput = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;

    const newValue = extractValueFromElement(el);

    // Mark as internal so the sync effect doesn't clobber the DOM
    isInternalChangeRef.current = true;
    onChange(newValue);

    // Detect $ to trigger autocomplete
    const pos = getCursorOffset(el);
    if (pos >= 0) {
      setCursorPosition(pos);
      const beforeCursor = newValue.slice(0, pos);
      const dollarIdx = beforeCursor.lastIndexOf("$");
      // Skip escaped \$ (literal dollar)
      const isEscaped = dollarIdx > 0 && beforeCursor[dollarIdx - 1] === "\\";
      if (dollarIdx >= 0 && !isEscaped) {
        const afterDollar = beforeCursor.slice(dollarIdx + 1);
        // Only trigger if $ is followed by nothing, or a letter/underscore (variable name start)
        // Skip if it starts with a digit (e.g. $5 for prices) or has whitespace
        if (!/\s/.test(afterDollar) && (afterDollar.length === 0 || /^[a-zA-Z_]/.test(afterDollar))) {
          // Calculate pixel offset of cursor relative to the editable container
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            setAutocompleteLeft(rect.left - elRect.left);
          }
          setShowAutocomplete(true);
          setAutocompleteQuery(afterDollar);
          setAutocompleteRange({ start: dollarIdx, end: pos });
          return;
        }
      }
    }
    setShowAutocomplete(false);
    setAutocompleteRange(null);
  }, [onChange]);

  const insertVariable = useCallback(
    (path: string) => {
      const el = editableRef.current;
      if (!el) {
        onChange(value + path);
        setShowAutocomplete(false);
        setAutocompleteRange(null);
        return;
      }

      let newValue: string;
      let newCursorRawPos: number;
      const hasValidRange =
        autocompleteRange &&
        autocompleteRange.start >= 0 &&
        autocompleteRange.end >= autocompleteRange.start &&
        autocompleteRange.end <= value.length &&
        value.slice(autocompleteRange.start, autocompleteRange.end).startsWith("$");

      if (hasValidRange && autocompleteRange) {
        newValue =
          value.slice(0, autocompleteRange.start) +
          path +
          value.slice(autocompleteRange.end);
        newCursorRawPos = autocompleteRange.start + path.length;
      } else {
        // Fallback: insert at cursor position
        const pos = getCursorOffset(el);
        const effectivePos = pos >= 0 ? pos : value.length;
        newValue = value.slice(0, effectivePos) + path + value.slice(effectivePos);
        newCursorRawPos = effectivePos + path.length;
      }

      onChange(newValue);
      setShowAutocomplete(false);
      setAutocompleteRange(null);

      // Restore cursor after React re-renders the contentEditable
      requestAnimationFrame(() => {
        if (el) {
          el.focus();
          placeCursorAtRawOffset(el, newCursorRawPos);
        }
      });
    },
    [value, onChange, autocompleteRange],
  );

  const insertFromPicker = useCallback(
    (path: string) => {
      const el = editableRef.current;
      const pos = el ? getCursorOffset(el) : -1;
      const effectivePos = pos >= 0 ? pos : value.length;
      const newValue = value.slice(0, effectivePos) + path + value.slice(effectivePos);
      const newCursorRawPos = effectivePos + path.length;
      onChange(newValue);

      requestAnimationFrame(() => {
        if (el) {
          el.focus();
          placeCursorAtRawOffset(el, newCursorRawPos);
        }
      });
    },
    [value, onChange],
  );

  return {
    showAutocomplete,
    autocompleteQuery,
    autocompleteLeft,
    cursorPosition,
    segments,
    editableRef,
    isInternalChangeRef,
    handleInput,
    insertVariable,
    insertFromPicker,
    setShowAutocomplete,
  };
}

/**
 * Place the cursor at a given raw-value character offset inside a contentEditable.
 * Walks child nodes, treating pill data-value lengths as atomic units.
 */
function placeCursorAtRawOffset(el: HTMLElement, rawOffset: number) {
  const sel = window.getSelection();
  if (!sel) return;

  const totalLength = getRawLength(el);
  const safeOffset = Math.max(0, Math.min(rawOffset, totalLength));
  const position = resolveCursorPosition(el, safeOffset);

  const range = document.createRange();

  range.setStart(position.container, position.offset);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}
