---
name: aggregator
description:
  Collects the items produced by a split's per-item branches back into a single
  array. Use to recombine results after a split before the workflow continues.
---

## Parameters

None.

## Output

| key          | type  | meaning                         |
| ------------ | ----- | ------------------------------- |
| `aggregated` | array | All collected per-item results. |

Reference downstream as `$NodeName.aggregated`.

## Notes

- Normally paired with an upstream `split`.
