---
name: limit
description:
  Truncates an array to its first N items. Use to cap a list — for example to take
  the top 10 — before further processing or display.
---
# limit

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `input_array` | any | no | current list | Array to limit. Omit to use the previous list node's output. |
| `count` | number | yes | — | Maximum number of items to keep. |

## Output

| key | type | meaning |
|-----|------|---------|
| `$json` | array | The first `count` items. |
| `count` | number | Number of items kept. |
| `original_count` | number | Number of items before limiting. |

Reference as `$NodeName.$json` (e.g. `$Limit.$json`), or just `$json` from the
node immediately after.

## Notes

- Omit `input_array` to chain directly from the preceding list node.
