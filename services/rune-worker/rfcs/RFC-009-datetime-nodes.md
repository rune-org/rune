# RFC-009: Date & Time Node Family (`dateTimeNow`, `dateTimeAdd`, `dateTimeSubtract`, `dateTimeFormat`, `dateTimeParse`)

**Author:** Shehab
**Status:** Implemented
**Created:** 2026-03-11
**Updated:** 2026-04-16
**Depends On:** RFC-001, RFC-002

## 1. Abstract

This RFC defines the date and time family: five typed worker nodes that cover common date/time generation, shifting, formatting, and decomposition inside workflows.

The family consists of:

- `dateTimeNow`: current time in a chosen timezone
- `dateTimeAdd`: shift a date/time forward by a duration
- `dateTimeSubtract`: shift a date/time backward by a duration
- `dateTimeFormat`: render a date/time using a chosen layout and timezone
- `dateTimeParse`: decompose a date/time into structured components

The family supersedes the original mode-switching `datetime` node defined in the first revision of this RFC.

## 2. Motivation

Workflows often need simple date/time handling without custom code, such as:

- "current time in `America/New_York`"
- "3 days from now"
- "subtract 2 weeks from this deadline"
- "format this timestamp for a message or API"
- "extract the weekday from this timestamp"

A single mode-switching node forced every inspector field to be conditionally rendered and made the parameter schema lie about which fields were required. Splitting the family into five typed nodes lets each node advertise exactly the parameters it needs, keeps the inspector linear, and makes the worker implementation a small switch-free function per node.

## 3. DSL Shape

All five nodes share two optional parameters:

- `timezone` (optional): IANA timezone used for parsing naive inputs and for the output; default `UTC`
- `format` (optional, where applicable): output format string (Go time layout); default `2006-01-02T15:04:05Z07:00`

### `dateTimeNow`

Parameters: `timezone`, `format`.

### `dateTimeAdd`

Parameters:

- `date` (optional): input date or timestamp; defaults to the current time when empty
- `amount` (required): number of units to add
- `unit` (optional): `seconds`, `minutes`, `hours`, `days`, `weeks`, `months`, `years`; default `days`
- `timezone`, `format`

### `dateTimeSubtract`

Same shape as `dateTimeAdd`; `amount` is subtracted from the base time.

### `dateTimeFormat`

Parameters:

- `date` (required): input date or timestamp to format
- `timezone`, `format`

### `dateTimeParse`

Parameters:

- `date` (required): input date or timestamp to decompose
- `timezone`

## 4. Execution Model

Every node in the family is stateless and purely functional:

1. Resolve configured parameters.
2. Load the requested timezone via the shared `datetimeops.LoadLocation` helper.
3. Determine the base time (current time, or parsed input).
4. Apply the node-specific operation (no-op, add/subtract offset, format, decompose).
5. Return a structured output map.

Parsing is centralized in `datetimeops.ParseDateInLocation`, which always calls `time.ParseInLocation` so that naive inputs are interpreted in the caller-supplied location and explicit offsets in the input are honored by the standard library. Add and Subtract pass their own configured output `format` as an extra layout so that the formatted result of one datetime node can be piped into another (see §7).

No Redis coordination, branch handling, or executor special cases are required.

## 5. Output Contract

`dateTimeNow`, `dateTimeAdd`, `dateTimeSubtract`, and `dateTimeFormat` return:

- `result`: formatted output string (using the configured layout)
- `iso`: same instant rendered as RFC3339 for machine consumers
- `unix`: Unix timestamp in seconds for the computed instant
- `timezone`: resolved timezone name

`dateTimeParse` returns:

- `unix`, `iso`, `timezone` (as above)
- `year`, `month`, `day`, `hour`, `minute`, `second`: integer components
- `weekday`: weekday name (e.g. `Sunday`)

Returning both a formatted string and the underlying instant makes it easy to validate display formatting and the computed instant in the same step.

## 6. Validation Rules

Per node:

- All nodes: invalid timezone must fail.
- `dateTimeAdd`, `dateTimeSubtract`: `amount` is required; unsupported `unit` must fail.
- `dateTimeFormat`, `dateTimeParse`: `date` is required.
- Unparseable date strings must fail.

The family rejects invalid input rather than silently returning unchanged or misleading values.

## 7. Supported Input Formats

`datetimeops.ParseDateInLocation` accepts the shared `listops.CommonTimeFormats` list, including:

- RFC3339 / RFC3339Nano
- `2006-01-02 15:04:05`
- `2006-01-02 15:04`
- `2006-01-02`
- common RFC822 / RFC1123 variants
- minute-precision RFC1123 variants (no seconds), so the format presets emitted by the inspector round-trip when one datetime node is piped into another (see issue #525)

Add and Subtract additionally pass their configured output `format` as an extra layout, so user-defined custom layouts also round-trip when chained.

## 8. Design Decisions

### Typed family instead of a mode-switching node

Splitting the original `datetime` node into five typed nodes removes runtime branching on an `operation` parameter, lets each node advertise exactly the parameters it needs, and keeps the inspector form linear instead of a tree of conditional fields. It also makes the palette discoverable: users see "Add Date/Time" and "Format Date/Time" by name in the canvas library.

### Shared `datetimeops` package

All parsing, location loading, and offset application live in a single helper package so that each node body stays small and the family stays consistent (one parser, one DST policy, one location-loading error message).

### Use explicit timezone handling

Formatting and parsing happen in the requested timezone so that outputs match user expectations when building reminders, messages, and exports. Naive inputs are always interpreted in the caller-supplied location.

### Test with fixed clocks

Each node that depends on the wall clock injects a `now func() time.Time` field so that unit tests are deterministic.

## 9. Testing Strategy

Tests cover:

- fixed `now` output in UTC and in a non-UTC timezone
- add and subtract across all supported units
- DST-crossing adds in `America/New_York`
- naive inputs interpreted in the configured timezone
- explicit offsets honored on input
- chained round-trip through a custom RFC1123 layout (issue #525 regression)
- invalid timezone, missing `date`, missing `amount`, and unparseable date strings
- shared `datetimeops` helpers tested directly

## 10. Acceptance Criteria

- worker registers and executes each node in the family
- invalid inputs fail clearly per the rules in §6
- realistic unit tests cover timezone, formatting, and DST behavior
- chained datetime nodes round-trip through the inspector's format presets
- full worker test suite passes

## 11. Migration Notes

The original `datetime` node type is removed from the worker registry and from the DSL `type` enum. The five typed nodes are not drop-in replacements at the DSL level: a workflow using `{ "type": "datetime", "parameters": { "operation": "add", ... } }` will fail DSL sanitization and worker dispatch. Because the original node had not yet seen meaningful adoption, no automatic migration ships with this change.
