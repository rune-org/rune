# RFC-009: Date & Time Node (`datetime`)

**Author:** Shehab
**Status:** Implemented
**Created:** 2026-03-11
**Depends On:** RFC-001, RFC-002

## 1. Abstract

This RFC defines the `datetime` node, a lightweight utility node for creating, shifting, and formatting date/time values inside workflows.

The v1 node supports four operations:

- `now`
- `add`
- `subtract`
- `format`

## 2. Motivation

Workflows often need simple date/time handling without custom code, such as:

- "3 days from now"
- "subtract 2 weeks from this deadline"
- "format this timestamp for a message or API"

The goal is to support these common cases without introducing a large scheduling or calendar subsystem.

## 3. DSL Shape

Parameters:

- `operation` (required): `now`, `add`, `subtract`, `format`
- `date` (optional): input date/time string; required for `add`, `subtract`, and `format`
- `amount` (optional): amount to shift; required for `add` and `subtract`
- `unit` (optional): `seconds`, `minutes`, `hours`, `days`, `weeks`, `months`, `years`; default `days`
- `format` (optional): output format string; default RFC3339-compatible format
- `timezone` (optional): timezone used for parsing and formatting; default `UTC`

## 4. Execution Model

The node is stateless and purely functional:

1. Resolve configured parameters.
2. Load the requested timezone.
3. Determine the base time:
   - current time for `now`
   - parsed input date for `add`, `subtract`, and `format`
4. Apply time shifting if needed.
5. Return a structured output map.

No Redis coordination, branch handling, or executor special cases are required.

## 5. Output Contract

The node returns:

- `result`: formatted output string
- `formatted`: same formatted output string
- `unix`: Unix timestamp in seconds for the computed instant
- `timezone`: resolved timezone name
- `operation`: executed operation name

Returning both formatted output and Unix time makes it easier to validate both display formatting and the underlying instant.

## 6. Validation Rules

- invalid timezone must fail
- unsupported operation must fail
- `date` is required for `add`, `subtract`, and `format`
- `amount` is required for `add` and `subtract`
- unparseable date strings must fail

The node should reject invalid input rather than silently returning unchanged or misleading values.

## 7. Supported Input Formats

The node accepts a practical set of common formats, including:

- RFC3339 / RFC3339Nano
- `2006-01-02 15:04:05`
- `2006-01-02 15:04`
- `2006-01-02`
- common RFC822 / RFC1123 variants

This keeps the node useful while still keeping the parser predictable.

## 8. Design Decisions

### Keep v1 intentionally narrow

This node is not meant to be a full calendar engine. It only covers simple date/time generation, shifting, and formatting.

### Use explicit timezone handling

Formatting and parsing should happen in the requested timezone so that outputs match user expectations when building reminders, messages, and exports.

### Test with fixed clocks

The worker implementation should inject a test clock for `now` to keep unit tests deterministic.

## 9. Testing Strategy

Tests should cover:

- fixed `now` output
- add and subtract with multiple units
- timezone-aware formatting
- invalid timezone handling
- missing `date` / `amount`
- bad input parsing

## 10. Acceptance Criteria

- worker executes `datetime` with the four supported operations
- invalid inputs fail clearly
- realistic unit tests cover timezone and formatting behavior
- full worker test suite passes
