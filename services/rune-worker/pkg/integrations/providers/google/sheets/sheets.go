package sheets

const (
	ReadRangeKind         = "integration.google.sheets.read_range"
	WriteRangeKind        = "integration.google.sheets.write_range"
	AppendRowKind         = "integration.google.sheets.append_row"
	ClearSheetKind        = "integration.google.sheets.clear"
	CreateSheetKind       = "integration.google.sheets.create_sheet"
	DeleteSheetKind       = "integration.google.sheets.delete_sheet"
	DeleteRowsKind        = "integration.google.sheets.delete_rows"
	DeleteColumnsKind     = "integration.google.sheets.delete_columns"
	UpdateRowKind         = "integration.google.sheets.update_row"
	CreateSpreadsheetKind = "integration.google.sheets.create_spreadsheet"
	DeleteSpreadsheetKind = "integration.google.sheets.delete_spreadsheet"
)

var baseURL = "https://sheets.googleapis.com"
var driveBaseURL = "https://www.googleapis.com"
