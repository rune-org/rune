/*
Package api provides an HTTP client for the RUNE FastAPI backend.

The client handles authentication, token refresh, and provides
typed methods for all API endpoints.

Usage:

	client := api.NewClient("http://localhost:8000")

	// Login
	resp, err := client.Login("admin@example.com", "password")

	// Make authenticated requests
	users, err := client.ListUsers()
*/
package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/rune-org/rune-cli/internal/config"
	"github.com/rune-org/rune-cli/internal/models"
)

// Client is the HTTP client for the RUNE API
type Client struct {
	baseURL    string
	httpClient *resty.Client
	token      string
}

// NewClient creates a new API client with the given base URL
func NewClient(baseURL string) *Client {
	client := resty.New()
	client.SetTimeout(30 * time.Second)
	client.SetHeader("Content-Type", "application/json")
	client.SetHeader("Accept", "application/json")

	return &Client{
		baseURL:    baseURL,
		httpClient: client,
	}
}

// NewClientFromConfig creates a client using the stored configuration
func NewClientFromConfig() *Client {
	cfg := config.Get()
	client := NewClient(cfg.APIURL)

	// Load stored credentials if available
	if creds, err := config.LoadCredentials(); err == nil && creds != nil {
		client.SetToken(creds.AccessToken)
	}

	return client
}

// SetToken sets the authentication token for API requests
func (c *Client) SetToken(token string) {
	c.token = token
	c.httpClient.SetAuthToken(token)
}

// SetTimeout sets the request timeout
func (c *Client) SetTimeout(d time.Duration) {
	c.httpClient.SetTimeout(d)
}

// endpoint builds a full URL from a path
func (c *Client) endpoint(path string) string {
	return fmt.Sprintf("%s/api%s", c.baseURL, path)
}

// handleError extracts error details from an API response
func handleError(resp *resty.Response) error {
	if resp.IsSuccess() {
		return nil
	}

	var errResp models.ErrorResponse
	if err := json.Unmarshal(resp.Body(), &errResp); err == nil && errResp.Detail != "" {
		return fmt.Errorf("API error (%d): %s", resp.StatusCode(), errResp.Detail)
	}

	return fmt.Errorf("API error (%d): %s", resp.StatusCode(), resp.Status())
}

// Health checks if the API is reachable and healthy
func (c *Client) Health() (*models.HealthStatus, error) {
	resp, err := c.httpClient.R().
		Get(fmt.Sprintf("%s/health", c.baseURL))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to API: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var health models.HealthStatus
	if err := json.Unmarshal(resp.Body(), &health); err != nil {
		return nil, fmt.Errorf("failed to parse health response: %w", err)
	}

	return &health, nil
}

// Ping does a simple connectivity check
func (c *Client) Ping() error {
	resp, err := c.httpClient.R().
		Get(fmt.Sprintf("%s/health", c.baseURL))
	if err != nil {
		return fmt.Errorf("cannot reach API: %w", err)
	}

	if resp.StatusCode() != http.StatusOK {
		return fmt.Errorf("API returned status %d", resp.StatusCode())
	}

	return nil
}

// CheckSetup checks if first-time setup is needed
func (c *Client) CheckSetup() (*models.SetupStatus, error) {
	resp, err := c.httpClient.R().
		Get(c.endpoint("/setup/status"))
	if err != nil {
		return nil, fmt.Errorf("failed to check setup status: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var status models.SetupStatus
	if err := json.Unmarshal(resp.Body(), &status); err != nil {
		return nil, fmt.Errorf("failed to parse setup response: %w", err)
	}

	return &status, nil
}

// Login authenticates with email and password
func (c *Client) Login(email, password string) (*models.LoginResponse, error) {
	req := models.LoginRequest{
		Email:    email,
		Password: password,
	}

	resp, err := c.httpClient.R().
		SetBody(req).
		Post(c.endpoint("/auth/login"))
	if err != nil {
		return nil, fmt.Errorf("login request failed: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var loginResp models.LoginResponse
	if err := json.Unmarshal(resp.Body(), &loginResp); err != nil {
		return nil, fmt.Errorf("failed to parse login response: %w", err)
	}

	// Set the token for future requests
	c.SetToken(loginResp.AccessToken)

	return &loginResp, nil
}

// Logout invalidates the current session
func (c *Client) Logout() error {
	resp, err := c.httpClient.R().
		Post(c.endpoint("/auth/logout"))
	if err != nil {
		return fmt.Errorf("logout request failed: %w", err)
	}

	if !resp.IsSuccess() && resp.StatusCode() != http.StatusUnauthorized {
		return handleError(resp)
	}

	c.token = ""
	return nil
}

// RefreshToken attempts to refresh the access token
func (c *Client) RefreshToken(refreshToken string) (*models.LoginResponse, error) {
	resp, err := c.httpClient.R().
		SetBody(map[string]string{"refresh_token": refreshToken}).
		Post(c.endpoint("/auth/refresh"))
	if err != nil {
		return nil, fmt.Errorf("token refresh failed: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var loginResp models.LoginResponse
	if err := json.Unmarshal(resp.Body(), &loginResp); err != nil {
		return nil, fmt.Errorf("failed to parse refresh response: %w", err)
	}

	c.SetToken(loginResp.AccessToken)
	return &loginResp, nil
}

// InitializeSetup creates the first admin user
func (c *Client) InitializeSetup(email, password, firstName, lastName string) (*models.User, error) {
	req := map[string]string{
		"email":      email,
		"password":   password,
		"first_name": firstName,
		"last_name":  lastName,
	}

	resp, err := c.httpClient.R().
		SetBody(req).
		Post(c.endpoint("/setup/initialize"))
	if err != nil {
		return nil, fmt.Errorf("setup request failed: %w", err)
	}

	if !resp.IsSuccess() {
		return nil, handleError(resp)
	}

	var user models.User
	if err := json.Unmarshal(resp.Body(), &user); err != nil {
		return nil, fmt.Errorf("failed to parse setup response: %w", err)
	}

	return &user, nil
}
