---
name: sort
description:
  Orders the items of an array by one or more fields. Use to arrange a list — for
  example by date or name — before limiting, displaying, or otherwise consuming
  it.
---
# sort

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `input_array` | any | no | current list | Array to sort. Omit to use the previous list node's output. |
| `rules` | array | yes | — | Ordered list of `{field, direction, type}`. |

Each rule: `field` (path to sort by), `direction` (`asc` or `desc`), `type`
(one of `auto`, `text`, `number`, `date`; default `auto`).

## Output

| key | type | meaning |
|-----|------|---------|
| `$json` | array | The sorted array. |
| `count` | number | Number of items. |

Reference as `$NodeName.$json` (e.g. `$Sort.$json`), or just `$json` from the
node immediately after.

## Notes

- Omit `input_array` to chain directly from the preceding list node.
