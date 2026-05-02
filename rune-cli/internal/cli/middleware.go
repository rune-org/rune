/*
Package cli - middleware.go provides authentication and authorization middleware.

These are PersistentPreRun hooks for cobra commands that enforce:
  - requireAuth: user must be logged in with a valid (non-expired) token
  - requireAdmin: user must be logged in AND have the "admin" role

Both middleware functions attempt automatic token refresh if the access
token is near expiry but a valid refresh token is available.
*/
package cli

import (
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/rune-org/rune-cli/internal/api"
	"github.com/rune-org/rune-cli/internal/config"
	"github.com/rune-org/rune-cli/internal/theme"
)

// requireAuth returns a PersistentPreRunE that ensures the user is authenticated.
// If the access token is within 2 minutes of expiry and a refresh token exists,
// it will attempt to auto-refresh.
func requireAuth(cmd *cobra.Command, args []string) error {
	creds, err := config.LoadCredentials()
	if err != nil || creds == nil || creds.AccessToken == "" {
		printError("Authentication required")
		printInfo("Run 'rune auth login' to authenticate")
		return fmt.Errorf("not authenticated")
	}

	// Check if token is expired or about to expire
	if time.Now().Add(2 * time.Minute).After(creds.ExpiresAt) {
		// Try to auto-refresh
		if creds.RefreshToken != "" {
			if refreshed := tryTokenRefresh(creds); refreshed {
				return nil
			}
		}
		printError("Session expired")
		printInfo("Run 'rune auth login' to re-authenticate")
		return fmt.Errorf("session expired")
	}

	return nil
}

// requireAdmin returns a PersistentPreRunE that ensures the user is
// authenticated AND has the "admin" role.
func requireAdmin(cmd *cobra.Command, args []string) error {
	if err := requireAuth(cmd, args); err != nil {
		return err
	}

	creds, _ := config.LoadCredentials()
	if creds.Role != "admin" {
		printError("Admin privileges required")
		fmt.Printf("  %s Your role: %s\n",
			theme.MutedStyle.Render("Current:"),
			theme.WarningStyle.Render(creds.Role))
		printInfo("Contact an administrator for access")
		return fmt.Errorf("insufficient privileges: admin role required")
	}

	return nil
}

// tryTokenRefresh attempts to refresh the access token using the stored refresh token.
// Returns true if the refresh succeeded and credentials were updated.
func tryTokenRefresh(creds *config.Credentials) bool {
	cfg := config.Get()
	client := api.NewClient(cfg.APIURL)

	resp, err := client.RefreshToken(creds.RefreshToken)
	if err != nil {
		return false
	}

	expiresAt := time.Now().Add(time.Duration(resp.ExpiresIn) * time.Second)

	newCreds := &config.Credentials{
		AccessToken:  resp.AccessToken,
		RefreshToken: resp.RefreshToken,
		ExpiresAt:    expiresAt,
		Email:        resp.User.Email,
		UserID:       resp.User.ID,
		Role:         resp.User.Role,
	}

	if err := config.SaveCredentials(newCreds); err != nil {
		return false
	}

	printInfo("Session refreshed automatically")
	return true
}
