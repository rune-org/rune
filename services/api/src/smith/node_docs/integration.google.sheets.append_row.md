---
name: integration.google.sheets.append_row
description:
  Appends one or more rows to the end of a Google Sheet, after the last row with
  data. Use to add new records without overwriting existing ones.
---
# integration.google.sheets.append_row

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `spreadsheet_id` | string | yes | — | The spreadsheet's ID. |
| `sheet_name` | string | yes | — | Worksheet tab name, e.g. `Sheet1`. |
| `values` | 2D array | yes | — | Row(s) to append, e.g. `[["Alice","a@example.com"]]`. |
| `value_input_option` | enum | no | — | `USER_ENTERED` or `RAW`. |

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Sheets API call. |
| `body` | object | Parsed Google Sheets API response. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

A summary of the appended cells is in `body.updates`.

## Notes

- Requires a Google credential selected on the canvas; the node will not run
  without one.
