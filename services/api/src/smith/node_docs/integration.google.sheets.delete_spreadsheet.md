---
name: integration.google.sheets.delete_spreadsheet
description:
  Deletes an entire Google spreadsheet, moving it to the Drive trash. Use to
  remove a whole document the workflow no longer needs.
---
# integration.google.sheets.delete_spreadsheet

## Parameters

| name | type | required | default | description |
|------|------|----------|---------|-------------|
| `spreadsheet_id` | string | yes | — | The spreadsheet's ID. |

## Output

| key | type | meaning |
|-----|------|---------|
| `status` | number | HTTP status of the Drive API call. |
| `body` | object | Parsed Google Drive API response. |
| `headers` | object | Response headers. |
| `duration_ms` | number | Call duration in milliseconds. |

## Notes

- Requires a Google credential selected on the canvas; the node will not run
  without one.
