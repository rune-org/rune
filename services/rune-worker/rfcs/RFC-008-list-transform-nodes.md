# RFC-008: List Transform Nodes (`filter`, `sort`, `limit`)

**Author:** Shehab
**Status:** Implemented
**Created:** 2026-03-11
**Depends On:** RFC-001, RFC-002, RFC-007

## 1. Abstract

This RFC defines three lightweight data-shaping nodes for list processing:

- `filter`: keep only items that match rules
- `sort`: reorder items by one or more fields
- `limit`: keep the first N items

These nodes are stateless worker transforms. They operate on the current working list, return an updated `"$json"`, and avoid introducing new executor or routing semantics.

## 2. Motivation

Non-technical workflow builders frequently need to:

- keep only matching records
- order records before sending or reviewing them
- reduce a long list to a smaller subset

Before these nodes, users would need awkward combinations of other nodes or custom logic. These three nodes cover common list manipulation needs with a predictable, guided configuration model.

## 3. DSL Shape

### `filter`

Parameters:

- `input_array` (optional): explicit array input; defaults to current `"$json"`
- `match_mode` (optional): `all` or `any`, default `all`
- `rules` (required): array of `FilterRule`

`FilterRule`:

- `field`: item field path
- `operator`: one of `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`
- `value`: comparison value

### `sort`

Parameters:

- `input_array` (optional): explicit array input; defaults to current `"$json"`
- `rules` (required): ordered array of `SortRule`

`SortRule`:

- `field`: item field path
- `direction`: `asc`, `desc`, `ascending`, or `descending`
- `type` (optional): `auto`, `text`, `number`, or `date`; default `auto`

### `limit`

Parameters:

- `input_array` (optional): explicit array input; defaults to current `"$json"`
- `count` (required): number of items to keep

## 4. Execution Model

These nodes follow the same high-level execution model as the Edit node:

1. Resolve node parameters against accumulated context.
2. Resolve the input array from either `input_array` or the current `"$json"`.
3. Apply the list operation in memory.
4. Return a new output map containing an updated `"$json"` and metadata.

These nodes are:

- stateless
- purely functional
- linear (no branching behavior)
- safe to scale horizontally across workers

## 5. Shared Worker Behavior

To keep behavior consistent, the worker uses shared helper logic for:

- resolving array input from direct values or references
- reading nested fields from list items
- comparing values for filtering and sorting
- coercing primitive values used in rules

This shared behavior lives in `pkg/nodes/shared/listops` and is intentionally used by all three nodes so they remain consistent over time.

## 6. Output Contract

### `filter`

Returns:

- `"$json"`: filtered list
- `count`: number of remaining items
- `original_count`: original item count

### `sort`

Returns:

- `"$json"`: sorted list
- `count`: number of items

### `limit`

Returns:

- `"$json"`: limited list
- `count`: number of remaining items
- `original_count`: original item count

The executor must propagate returned `"$json"` into downstream working context, just as it already does for the Edit node.

## 7. Validation Rules

- `filter` requires at least one rule
- `sort` requires at least one rule
- `limit` requires `count`
- all three fail if the resolved input is not an array
- `limit` fails on negative `count`
- unsupported sort types fail explicitly

These nodes should fail loudly rather than silently producing misleading results.

## 8. Design Decisions

### Guided rules instead of expressions

`filter` uses simple rule objects rather than free-form JavaScript expressions. This keeps the node easier to understand and reduces runtime complexity.

### Default to current `"$json"`

The common case is to transform the working list already flowing through the workflow. Optional `input_array` remains available for more explicit wiring.

### Missing values sort last

When sorting, missing or unreadable values are treated as `nil` and sorted last. This is more predictable for end users than failing every partially-populated item.

## 9. Testing Strategy

Tests should cover:

- explicit array input and default `"$json"` input
- numeric, text, and date sorting
- `all` and `any` filter behavior
- missing fields
- invalid configuration
- executor propagation of `"$json"`

## 10. Acceptance Criteria

- workers can execute `filter`, `sort`, and `limit`
- all three are registered in the node registry
- updated `"$json"` is visible to downstream nodes
- realistic unit tests cover success and failure paths
- full worker test suite passes
