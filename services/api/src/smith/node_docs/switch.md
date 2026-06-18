---
name: switch
description:
  Branches execution into multiple paths by matching a value against an ordered
  list of rules, with a catch-all fallback. Use for multi-way routing when an if
  node's two branches are not enough.
---
# switch

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `rules` | array | yes | — | Ordered list of `{value, operator, compare}`. |

Each rule: `value` (what to evaluate, e.g. `$GetUser.body.role`), `operator`
(one of `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`), `compare` (value to match
against).

## Output

This node routes execution rather than producing data to reference. Flow goes
down the edge of the first matching rule, or the `fallback` edge if none match.

## Notes

- Label outgoing edges `case 1`, `case 2`, … matching the rule order, plus one
  `fallback` edge for the default path.
