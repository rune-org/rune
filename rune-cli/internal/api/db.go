/*
Package api - db.go provides database introspection API methods for the CLI.

These methods call CLI-specific endpoints on the FastAPI backend.
All DB access is authenticated and authorized through the API layer.

Endpoints (all require admin role):
  - GET  /cli/db/health                 — Health check
  - GET  /cli/db/tables                 — List tables
  - GET  /cli/db/tables/{name}/data     — Browse table data
  - POST /cli/db/tables/{name}/truncate — Truncate a single table

No raw SQL. No schema-dropping operations.

Note: The FastAPI backend wraps responses in an ApiResponse envelope:
  {"success": bool, "message": "...", "data": <payload>}
These methods extract the "data" field automatically.
*/
package api

import (
	"encoding/json"
	"fmt"

	"github.com/rune-org/rune-cli/internal/models"
)

// apiResponse is the generic envelope used by the FastAPI backend.
type apiResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

// unwrapData extracts the "data" field from an ApiResponse envelope.
func unwrapData(body []byte, target any) error {
	var envelope apiResponse
	if err := json.Unmarshal(body, &envelope); err != nil {
		// Fallback: try parsing the body directly (non-wrapped response)
		return json.Unmarshal(body, target)
	}
	if !envelope.Success {
		return fmt.Errorf("API error: %s", envelope.Message)
	}
	return json.Unmarshal(envelope.Data, target)
}

// DBHealth checks the database health through the API.
func (c *Client) DBHealth() (*models.DBHealthInfo, error) {
	resp, err := c.httpClient.R().
		Get(c.endpoint("/cli/db/health"))
	if err != nil {
		return nil, fmt.Errorf("failed to check DB health: %w", err)
	}
	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var health models.DBHealthInfo
	if err := unwrapData(resp.Body(), &health); err != nil {
		return nil, fmt.Errorf("failed to parse DB health response: %w", err)
	}
	return &health, nil
}

// DBListTables retrieves all database tables with statistics.
func (c *Client) DBListTables() ([]models.DBTableInfo, error) {
	resp, err := c.httpClient.R().
		Get(c.endpoint("/cli/db/tables"))
	if err != nil {
		return nil, fmt.Errorf("failed to list DB tables: %w", err)
	}
	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var tables []models.DBTableInfo
	if err := unwrapData(resp.Body(), &tables); err != nil {
		return nil, fmt.Errorf("failed to parse tables response: %w", err)
	}
	return tables, nil
}

// DBTableData retrieves rows from a specific table (read-only).
func (c *Client) DBTableData(tableName string, limit int) (*models.DBTableData, error) {
	resp, err := c.httpClient.R().
		SetQueryParam("limit", fmt.Sprintf("%d", limit)).
		Get(c.endpoint(fmt.Sprintf("/cli/db/tables/%s/data", tableName)))
	if err != nil {
		return nil, fmt.Errorf("failed to get table data: %w", err)
	}
	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var data models.DBTableData
	if err := unwrapData(resp.Body(), &data); err != nil {
		return nil, fmt.Errorf("failed to parse table data response: %w", err)
	}
	return &data, nil
}

// DBTruncateTable removes all data from a specific table (admin only).
func (c *Client) DBTruncateTable(tableName string) error {
	resp, err := c.httpClient.R().
		Post(c.endpoint(fmt.Sprintf("/cli/db/tables/%s/truncate", tableName)))
	if err != nil {
		return fmt.Errorf("failed to truncate table: %w", err)
	}
	if !resp.IsSuccess() {
		return handleError(resp)
	}
	return nil
}
