/*
Package api - users.go provides user management API methods.

These methods correspond to the /api/users endpoints in the FastAPI backend.
All responses are wrapped in an ApiResponse envelope and extracted via unwrapData.
*/
package api

import (
	"fmt"

	"github.com/rune-org/rune-cli/internal/models"
)

// ListUsers retrieves all users (admin only)
func (c *Client) ListUsers() ([]models.User, error) {
	resp, err := c.httpClient.R().
		Get(c.endpoint("/users/"))
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var users []models.User
	if err := unwrapData(resp.Body(), &users); err != nil {
		return nil, fmt.Errorf("failed to parse users response: %w", err)
	}

	return users, nil
}

// GetUser retrieves a single user by ID
func (c *Client) GetUser(userID int) (*models.User, error) {
	resp, err := c.httpClient.R().
		Get(c.endpoint(fmt.Sprintf("/users/%d", userID)))
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var user models.User
	if err := unwrapData(resp.Body(), &user); err != nil {
		return nil, fmt.Errorf("failed to parse user response: %w", err)
	}

	return &user, nil
}

// CreateUser creates a new user (admin only)
func (c *Client) CreateUser(req *models.UserCreate) (*models.User, error) {
	resp, err := c.httpClient.R().
		SetBody(req).
		Post(c.endpoint("/users/"))
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var user models.User
	if err := unwrapData(resp.Body(), &user); err != nil {
		return nil, fmt.Errorf("failed to parse create response: %w", err)
	}

	return &user, nil
}

// UpdateUser updates an existing user
func (c *Client) UpdateUser(userID int, req *models.UserUpdate) (*models.User, error) {
	resp, err := c.httpClient.R().
		SetBody(req).
		Put(c.endpoint(fmt.Sprintf("/users/%d", userID)))
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var user models.User
	if err := unwrapData(resp.Body(), &user); err != nil {
		return nil, fmt.Errorf("failed to parse update response: %w", err)
	}

	return &user, nil
}

// DeleteUser removes a user (admin only)
func (c *Client) DeleteUser(userID int) error {
	resp, err := c.httpClient.R().
		Delete(c.endpoint(fmt.Sprintf("/users/%d", userID)))
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	if !resp.IsSuccess() {
		return handleError(resp)
	}

	return nil
}

// ResetPassword resets a user's password (admin only)
func (c *Client) ResetPassword(userID int, newPassword string) error {
	resp, err := c.httpClient.R().
		SetBody(map[string]string{"password": newPassword}).
		Post(c.endpoint(fmt.Sprintf("/users/%d/password", userID)))
	if err != nil {
		return fmt.Errorf("failed to reset password: %w", err)
	}

	if !resp.IsSuccess() {
		return handleError(resp)
	}

	return nil
}

// SetUserStatus activates or deactivates a user
func (c *Client) SetUserStatus(userID int, isActive bool) (*models.User, error) {
	resp, err := c.httpClient.R().
		SetBody(map[string]bool{"is_active": isActive}).
		Patch(c.endpoint(fmt.Sprintf("/users/%d/status", userID)))
	if err != nil {
		return nil, fmt.Errorf("failed to update user status: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var user models.User
	if err := unwrapData(resp.Body(), &user); err != nil {
		return nil, fmt.Errorf("failed to parse status response: %w", err)
	}

	return &user, nil
}

// GetProfile retrieves the current user's profile
func (c *Client) GetProfile() (*models.User, error) {
	resp, err := c.httpClient.R().
		Get(c.endpoint("/profile/me"))
	if err != nil {
		return nil, fmt.Errorf("failed to get profile: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var user models.User
	if err := unwrapData(resp.Body(), &user); err != nil {
		return nil, fmt.Errorf("failed to parse profile response: %w", err)
	}

	return &user, nil
}
