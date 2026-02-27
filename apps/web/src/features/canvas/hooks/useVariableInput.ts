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
export function extractValueFromElement(el: HTMLElement, isRoot = true): string {
  let result = "";
  const children = Array.from(el.childNodes);
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const dataValue = element.getAttribute("data-value");
      if (dataValue) {
        // This is a pill, use its raw $expression
        result += dataValue;
      } else if (element.tagName === "BR") {
        result += "\n";
      } else if (element.tagName === "DIV" || element.tagName === "P") {
        // Chrome wraps new lines in <div> elements; Firefox/Safari may use <p>.
        // Each block element after the first represents a new line.
        if (i > 0) result += "\n";
        result += extractValueFromElement(element, false);
      } else {
        result += extractValueFromElement(element, false);
      }
    }
  }

  if (isRoot) {
    result = result.replace(/[\u200B\uFEFF]/g, "").replace(/\u00A0/g, " ");
  }

  return result;
}

/**
 * Get the cursor offset in terms of raw value characters.
 * Walks the DOM to map the Selection offset back to our raw string.
 */
function getCursorOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;

  const range = sel.getRangeAt(0);
  // Create a range from start of el to the cursor
  const preRange = document.createRange();
  preRange.setStart(el, 0);
  preRange.setEnd(range.startContainer, range.startOffset);

  // Walk nodes in the pre-range to count raw characters
  let offset = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ALL);
  let node: Node | null = walker.firstChild();

  while (node) {
    // Check if this node is past our cursor
    if (!preRange.intersectsNode(node)) {
      node = walker.nextNode();
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      if (node === range.startContainer) {
        offset += range.startOffset;
        break;
      }
      offset += node.textContent?.length ?? 0;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const dataValue = element.getAttribute("data-value");
      if (dataValue) {
        const cmp = range.comparePoint(node, 0);
        if (cmp <= 0) {
          offset += dataValue.length;
        }
        // Skip children of pill
        node = walker.nextSibling();
        continue;
      }
    }

    node = walker.nextNode();
  }

  return offset;
}

export function useVariableInput({ value, onChange }: UseVariableInputOptions) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
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
          return;
        }
      }
    }
    setShowAutocomplete(false);
  }, [onChange]);

  const insertVariable = useCallback(
    (path: string) => {
      const el = editableRef.current;
      if (!el) {
        onChange(value + path);
        setShowAutocomplete(false);
        return;
      }

      // Get raw cursor position
      const pos = getCursorOffset(el);
      const effectivePos = pos >= 0 ? pos : value.length;
      const beforeCursor = value.slice(0, effectivePos);

      // Find and replace the partial $query
      const dollarIdx = beforeCursor.lastIndexOf("$");
      let newValue: string;
      let newCursorRawPos: number;
      if (dollarIdx >= 0) {
        newValue = value.slice(0, dollarIdx) + path + value.slice(effectivePos);
        newCursorRawPos = dollarIdx + path.length;
      } else {
        newValue = value.slice(0, effectivePos) + path + value.slice(effectivePos);
        newCursorRawPos = effectivePos + path.length;
      }

      onChange(newValue);
      setShowAutocomplete(false);

      // Restore cursor after React re-renders the contentEditable
      requestAnimationFrame(() => {
        if (el) {
          el.focus();
          placeCursorAtRawOffset(el, newCursorRawPos);
        }
      });
    },
    [value, onChange],
  );

  const insertFromPicker = useCallback(
    (path: string) => {
      const el = editableRef.current;
      const pos = getCursorOffset(el!);
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
  let remaining = rawOffset;
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();

  for (const child of Array.from(el.childNodes)) {
    if (remaining <= 0) {
      range.setStartBefore(child);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }

    if (child.nodeType === Node.TEXT_NODE) {
      const len = child.textContent?.length ?? 0;
      if (remaining <= len) {
        range.setStart(child, remaining);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const element = child as HTMLElement;
      const dataValue = element.getAttribute("data-value");
      if (dataValue) {
        const len = dataValue.length;
        if (remaining <= len) {
          // Place cursor right after the pill
          range.setStartAfter(child);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
        remaining -= len;
      } else {
        const len = child.textContent?.length ?? 0;
        if (remaining <= len) {
          range.setStart(child, remaining);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
        remaining -= len;
      }
    }
  }

  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}
