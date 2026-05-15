package sheets

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"rune-worker/pkg/integrations/internal/connector"
	"rune-worker/plugin"
)

func optionalQuery(key, value string) map[string]string {
	if strings.TrimSpace(value) == "" {
		return map[string]string{}
	}
	return map[string]string{key: value}
}

func columnIndex(col string) (int, error) {
	if col == "" {
		return 0, errors.New("column is required")
	}
	idx := 0
	for _, ch := range col {
		if ch < 'A' || ch > 'Z' {
			if ch >= 'a' && ch <= 'z' {
				ch = ch - 'a' + 'A'
			} else {
				return 0, errors.New("column must use letters only")
			}
		}
		idx = idx*26 + int(ch-'A'+1)
	}
	return idx, nil
}

func columnName(index int) (string, error) {
	if index <= 0 {
		return "", errors.New("column index must be positive")
	}
	var b strings.Builder
	for index > 0 {
		index--
		b.WriteByte(byte('A' + (index % 26)))
		index /= 26
	}
	name := b.String()
	return reverseString(name), nil
}

func reverseString(s string) string {
	runes := []rune(s)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}
	return string(runes)
}

func buildRowRange(sheetName, startColumn string, rowNumber, columnCount int) (string, error) {
	if strings.TrimSpace(sheetName) == "" {
		return "", errors.New("sheet name is required")
	}
	if rowNumber <= 0 {
		return "", errors.New("row number must be >= 1")
	}
	startIndex, err := columnIndex(strings.TrimSpace(startColumn))
	if err != nil {
		return "", err
	}
	if columnCount <= 0 {
		return "", errors.New("column count must be >= 1")
	}
	endIndex := startIndex + columnCount - 1
	endColumn, err := columnName(endIndex)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s!%s%d:%s%d", strings.TrimSpace(sheetName), strings.TrimSpace(startColumn), rowNumber, endColumn, rowNumber), nil
}

func resolveSheetID(ctx context.Context, ec plugin.ExecutionContext, spreadsheetID, sheetName string) (int, error) {
	if strings.TrimSpace(spreadsheetID) == "" {
		return 0, errors.New("argument 'spreadsheet_id' is required")
	}
	if strings.TrimSpace(sheetName) == "" {
		return 0, errors.New("argument 'sheet_name' is required")
	}

	resp, err := connector.Do(ctx, ec, connector.Spec{
		Method:  "GET",
		BaseURL: baseURL,
		Path:    "/v4/spreadsheets/{spreadsheetId}",
		PathArgs: map[string]string{
			"spreadsheetId": spreadsheetID,
		},
		Query: map[string]string{
			"fields": "sheets.properties(sheetId,title)",
		},
	})
	if err != nil {
		return 0, err
	}

	body, ok := resp["body"].(map[string]any)
	if !ok {
		return 0, errors.New("unexpected response from sheets api")
	}
	items, ok := body["sheets"].([]any)
	if !ok {
		return 0, errors.New("unexpected response from sheets api")
	}
	for _, item := range items {
		entry, ok := item.(map[string]any)
		if !ok {
			continue
		}
		props, ok := entry["properties"].(map[string]any)
		if !ok {
			continue
		}
		title, _ := props["title"].(string)
		if title == sheetName {
			sheetID, ok := props["sheetId"].(float64)
			if ok {
				return int(sheetID), nil
			}
			if sheetIDInt, ok := props["sheetId"].(int); ok {
				return sheetIDInt, nil
			}
		}
	}
	return 0, fmt.Errorf("sheet %q not found", sheetName)
}

func coerceRows(values []any) ([][]any, error) {
	if len(values) == 0 {
		return nil, errors.New("argument 'values' is required")
	}
	rows := make([][]any, 0, len(values))
	for _, v := range values {
		row, ok := v.([]any)
		if !ok {
			return nil, errors.New("values must be a two-dimensional array")
		}
		rows = append(rows, row)
	}
	return rows, nil
}
