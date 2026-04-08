/*
Package api - workflows.go provides workflow management API methods.

These methods correspond to the /api/workflows endpoints in the FastAPI backend.
*/
package api

import (
	"encoding/json"
	"fmt"

	"github.com/rune-org/rune-cli/internal/models"
)

// ListWorkflows retrieves workflows accessible to the current user
func (c *Client) ListWorkflows() ([]models.Workflow, error) {
	resp, err := c.httpClient.R().
		Get(c.endpoint("/workflows/"))
	if err != nil {
		return nil, fmt.Errorf("failed to list workflows: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var workflows []models.Workflow
	if err := json.Unmarshal(resp.Body(), &workflows); err != nil {
		return nil, fmt.Errorf("failed to parse workflows response: %w", err)
	}

	return workflows, nil
}

// GetWorkflow retrieves a single workflow by ID
func (c *Client) GetWorkflow(workflowID int) (*models.Workflow, error) {
	resp, err := c.httpClient.R().
		Get(c.endpoint(fmt.Sprintf("/workflows/%d", workflowID)))
	if err != nil {
		return nil, fmt.Errorf("failed to get workflow: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var workflow models.Workflow
	if err := json.Unmarshal(resp.Body(), &workflow); err != nil {
		return nil, fmt.Errorf("failed to parse workflow response: %w", err)
	}

	return &workflow, nil
}

// TriggerWorkflow starts a workflow execution
func (c *Client) TriggerWorkflow(workflowID int, inputs map[string]any) (*models.Execution, error) {
	body := map[string]any{}
	if inputs != nil {
		body["inputs"] = inputs
	}

	resp, err := c.httpClient.R().
		SetBody(body).
		Post(c.endpoint(fmt.Sprintf("/workflows/%d/execute", workflowID)))
	if err != nil {
		return nil, fmt.Errorf("failed to trigger workflow: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var execution models.Execution
	if err := json.Unmarshal(resp.Body(), &execution); err != nil {
		return nil, fmt.Errorf("failed to parse execution response: %w", err)
	}

	return &execution, nil
}

// DeleteWorkflow removes a workflow
func (c *Client) DeleteWorkflow(workflowID int) error {
	resp, err := c.httpClient.R().
		Delete(c.endpoint(fmt.Sprintf("/workflows/%d", workflowID)))
	if err != nil {
		return fmt.Errorf("failed to delete workflow: %w", err)
	}

	if !resp.IsSuccess() {
		return handleError(resp)
	}

	return nil
}

// ListExecutions retrieves recent workflow executions
func (c *Client) ListExecutions() ([]models.Execution, error) {
	resp, err := c.httpClient.R().
		Get(c.endpoint("/executions/"))
	if err != nil {
		return nil, fmt.Errorf("failed to list executions: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var executions []models.Execution
	if err := json.Unmarshal(resp.Body(), &executions); err != nil {
		return nil, fmt.Errorf("failed to parse executions response: %w", err)
	}

	return executions, nil
}

// GetExecution retrieves a single execution by ID
func (c *Client) GetExecution(executionID string) (*models.Execution, error) {
	resp, err := c.httpClient.R().
		Get(c.endpoint(fmt.Sprintf("/executions/%s", executionID)))
	if err != nil {
		return nil, fmt.Errorf("failed to get execution: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var execution models.Execution
	if err := json.Unmarshal(resp.Body(), &execution); err != nil {
		return nil, fmt.Errorf("failed to parse execution response: %w", err)
	}

	return &execution, nil
}
