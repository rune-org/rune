---
name: merge
description:
  Rejoins multiple incoming branches back into a single path, optionally waiting
  for all of them to arrive. Use to converge the branches created by an if or
  switch before continuing.
---
# merge

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `wait_mode` | enum | no | `wait_for_all` | `wait_for_all` waits for every incoming branch; `wait_for_any` continues on the first to arrive. |
| `timeout` | number | no | `300` | Safety timeout in seconds. |

## Output

| key | type | meaning |
|-----|------|---------|
| `merged_context` | object | The combined data from the incoming branches. |

Reference downstream as `$NodeName.merged_context`.

## Notes

- Connect every branch you want to rejoin as an incoming edge to this node.
