---
name: filter
description:
  Keeps only the array items that match its rules and drops the rest. Use to
  narrow a list before further processing — e.g. keep only active users, or orders
  above a threshold.
---
# filter

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `input_array` | any | no | current list | Array to filter. Omit to use the previous list node's output. |
| `match_mode` | enum | no | `all` | `all` = every rule must match; `any` = at least one. |
| `rules` | array | yes | — | Rules of `{field, operator, value}`; operator is one of `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`. |

## Output

| key | type | meaning |
|-----|------|---------|
| `$json` | array | The items that matched. |
| `count` | number | Number of items kept. |
| `original_count` | number | Number of items before filtering. |

Reference as `$NodeName.$json` (e.g. `$Filter.$json`), or just `$json` from the
node immediately after. Counts are `$NodeName.count` / `$NodeName.original_count`.

## Notes

- Omit `input_array` to chain directly from the preceding list node.
