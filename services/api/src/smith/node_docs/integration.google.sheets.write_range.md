---
name: integration.google.sheets.write_range
description:
  Writes a 2D block of values into a specific range of a Google Sheet,
  overwriting existing cells. Use to set known cells — for example to fill a
  header row or update a table region.
---
# integration.google.sheets.write_range

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `spreadsheet_id` | string | yes | — | The spreadsheet's ID. |
| `range` | string | yes | — | A1-notation range, e.g. `Sheet1!A1:B2`. |
| `values` | 2D array | yes | — | Rows of cell values; must match the range shape, e.g. `[["Name","Email"],["Alice","a@example.com"]]`. |
| `value_input_option` | enum | no | — | `USER_ENTERED` (parse like the UI) or `RAW`. |

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Sheets API call. |
| `body` | object | Parsed Google Sheets API response. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

The number of cells written is in `body.updatedCells`.

## Notes

- Requires a Google credential selected on the canvas; the node will not run
  without one.
