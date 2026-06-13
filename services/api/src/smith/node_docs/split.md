---
name: split
description:
  Fans out an array so each item flows through the downstream nodes one at a time.
  Use to process every element of a list individually; pair with an aggregator to
  recombine the results.
---
# split

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `input_array` | string | yes | — | Reference to the array to iterate, e.g. `$Fetch.body.users`. |

## Output

Inside the split body, the current element is available as `$item` (e.g.
`$item.id`, `$item.email`). The downstream nodes run once per item.

## Notes

- Must be closed by an `aggregator` to collect the per-item results.
- Reference the current element as `$item`, not by this node's name.
