---
name: integration.google.sheets.read_range
description:
  Reads a range of cells from a Google Sheet and returns the values. Use to pull
  spreadsheet data into a workflow for processing, reporting, or syncing.
---
# integration.google.sheets.read_range

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `spreadsheet_id` | string | yes | — | The spreadsheet's ID (from its URL). |
| `range` | string | yes | — | A1-notation range, e.g. `Sheet1!A1:B10`. |

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Sheets API call. |
| `body` | object | Parsed Google Sheets API response. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

The cell data is in `body.values` (a 2D array). Reference as
`$NodeName.body.values`.

## Notes

- Requires a Google credential selected on the canvas; the node will not run
  without one.
