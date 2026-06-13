---
name: edit
description:
  Reshapes data by setting or computing fields, or by trimming an object down to a
  chosen subset of fields. Use to build or clean up a payload before passing it on
  — e.g. compose a request body or derive new fields.
---
# edit

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `mode` | enum | no | `assignments` | `assignments` sets/computes fields; `keep_only` drops everything except the listed fields. |
| `assignments` | array | no | `[]` | List of `{name, value, type}`. |

Each assignment: `name` (field to set, supports dot-notation for nested keys),
`value` (value or expression, supports `$Node.field`), `type` (one of `string`,
`number`, `boolean`, `json`).

## Output

| key | type | meaning |
|-----|------|---------|
| `$json` | object \| array | The transformed data. |

Reference as `$NodeName.$json` (e.g. `$Edit.$json`), or just `$json` from the
node immediately after.

## Notes

- In `keep_only` mode, only the fields named in `assignments` are retained.
