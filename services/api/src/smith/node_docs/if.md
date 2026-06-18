---
name: if
description:
  Branches execution down a true or false path based on a boolean expression. Use
  to take one of two routes depending on a condition — e.g. a status check or a
  value comparison.
---
# if

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `expression` | string | yes | — | Boolean expression to evaluate, e.g. `$Fetch.status == 200`. |

## Output

This node routes execution rather than producing data to reference. Flow goes
down the `true` edge when the expression is truthy, otherwise the `false` edge.
(`result` and `expression` are also available but are rarely referenced.)

## Notes

- Create exactly two outgoing edges, labelled `true` and `false`.
