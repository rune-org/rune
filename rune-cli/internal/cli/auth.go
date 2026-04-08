/*
Package cli - auth.go provides authentication commands.

Commands:
  - rune auth login    Authenticate with the RUNE API
  - rune auth logout   Clear stored credentials
  - rune auth status   Check authentication status
  - rune auth signup   Create first admin account (setup mode)
*/
package cli

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/term"

	"github.com/rune-org/rune-cli/internal/api"
	"github.com/rune-org/rune-cli/internal/config"
	"github.com/rune-org/rune-cli/internal/theme"
)

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authentication commands",
	Long:  "Manage authentication with the RUNE API server.",
}

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Login to the RUNE API",
	Long:  "Authenticate with email and password to access the RUNE API.",
	RunE:  runLogin,
}

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Logout and clear credentials",
	Long:  "Clear stored authentication credentials.",
	RunE:  runLogout,
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Check authentication status",
	Long:  "Display current authentication status and token information.",
	RunE:  runStatus,
}

var signupCmd = &cobra.Command{
	Use:   "signup",
	Short: "Create first admin account",
	Long:  "Create the initial admin account during first-time setup.",
	RunE:  runSignup,
}

func init() {
	authCmd.AddCommand(loginCmd)
	authCmd.AddCommand(logoutCmd)
	authCmd.AddCommand(statusCmd)
	authCmd.AddCommand(signupCmd)

	loginCmd.Flags().StringP("email", "e", "", "Email address")
	loginCmd.Flags().StringP("password", "p", "", "Password (not recommended, use interactive prompt)")
}

func runLogin(cmd *cobra.Command, args []string) error {
	cfg := config.Get()
	client := api.NewClient(cfg.APIURL)

	// Check API connectivity first
	if err := client.Ping(); err != nil {
		printError(fmt.Sprintf("Cannot connect to API at %s", cfg.APIURL))
		printInfo("Make sure the API server is running")
		return err
	}

	email, _ := cmd.Flags().GetString("email")
	password, _ := cmd.Flags().GetString("password")

	// Prompt for email if not provided
	if email == "" {
		fmt.Print(theme.PromptStyle.Render("Email: "))
		reader := bufio.NewReader(os.Stdin)
		input, err := reader.ReadString('\n')
		if err != nil {
			return fmt.Errorf("failed to read email: %w", err)
		}
		email = strings.TrimSpace(input)
	}

	// Prompt for password if not provided
	if password == "" {
		fmt.Print(theme.PromptStyle.Render("Password: "))
		passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
		if err != nil {
			return fmt.Errorf("failed to read password: %w", err)
		}
		password = string(passwordBytes)
		fmt.Println()
	}

	// Attempt login
	fmt.Println(theme.MutedStyle.Render("Authenticating..."))

	resp, err := client.Login(email, password)
	if err != nil {
		printError("Login failed: " + err.Error())
		return err
	}

	// Calculate expiration time
	expiresAt := time.Now().Add(time.Duration(resp.ExpiresIn) * time.Second)

	// Save credentials
	creds := &config.Credentials{
		AccessToken:  resp.AccessToken,
		RefreshToken: resp.RefreshToken,
		ExpiresAt:    expiresAt,
		Email:        resp.User.Email,
		UserID:       resp.User.ID,
		Role:         resp.User.Role,
	}

	if err := config.SaveCredentials(creds); err != nil {
		printWarning("Logged in but failed to save credentials: " + err.Error())
		return nil
	}

	printSuccess(fmt.Sprintf("Logged in as %s (%s)", resp.User.Email, resp.User.Role))
	return nil
}

func runLogout(cmd *cobra.Command, args []string) error {
	// Try to call API logout if we have credentials
	if config.IsAuthenticated() {
		client := api.NewClientFromConfig()
		_ = client.Logout() // Ignore errors, we'll clear local credentials anyway
	}

	if err := config.ClearCredentials(); err != nil {
		printError("Failed to clear credentials: " + err.Error())
		return err
	}

	printSuccess("Logged out successfully")
	return nil
}

func runStatus(cmd *cobra.Command, args []string) error {
	creds, err := config.LoadCredentials()
	if err != nil {
		printError("Failed to load credentials: " + err.Error())
		return err
	}

	if creds == nil || creds.AccessToken == "" {
		printWarning("Not logged in")
		printInfo("Run 'rune auth login' to authenticate")
		return nil
	}

	fmt.Println(theme.SectionHeader("Authentication Status"))

	// Check if token is expired
	isExpired := time.Now().After(creds.ExpiresAt)

	if isExpired {
		fmt.Printf("  Status:  %s\n", theme.WarningStyle.Render("Token Expired"))
	} else {
		fmt.Printf("  Status:  %s\n", theme.SuccessStyle.Render("Authenticated"))
	}

	fmt.Printf("  Email:   %s\n", creds.Email)
	fmt.Printf("  User ID: %d\n", creds.UserID)
	fmt.Printf("  Role:    %s\n", strings.ToUpper(creds.Role))

	if !isExpired {
		remaining := time.Until(creds.ExpiresAt)
		fmt.Printf("  Expires: %s (in %s)\n",
			creds.ExpiresAt.Format(time.RFC3339),
			remaining.Round(time.Minute))
	} else {
		fmt.Printf("  Expired: %s\n", creds.ExpiresAt.Format(time.RFC3339))
		printInfo("Run 'rune auth login' to re-authenticate")
	}

	return nil
}

func runSignup(cmd *cobra.Command, args []string) error {
	cfg := config.Get()
	client := api.NewClient(cfg.APIURL)

	// Check if first-time setup is available
	status, err := client.CheckSetup()
	if err != nil {
		printError("Cannot check setup status: " + err.Error())
		return err
	}

	if !status.IsFirstTimeSetup {
		printWarning("First-time setup has already been completed")
		printInfo("Use 'rune auth login' to authenticate")
		return nil
	}

	fmt.Println(theme.SectionHeader("First-Time Setup"))
	fmt.Println(theme.MutedStyle.Render("Create the first admin account for your RUNE instance."))
	fmt.Println()

	reader := bufio.NewReader(os.Stdin)

	// Collect admin details
	fmt.Print(theme.PromptStyle.Render("Email: "))
	email, _ := reader.ReadString('\n')
	email = strings.TrimSpace(email)

	fmt.Print(theme.PromptStyle.Render("First Name: "))
	firstName, _ := reader.ReadString('\n')
	firstName = strings.TrimSpace(firstName)

	fmt.Print(theme.PromptStyle.Render("Last Name: "))
	lastName, _ := reader.ReadString('\n')
	lastName = strings.TrimSpace(lastName)

	fmt.Print(theme.PromptStyle.Render("Password: "))
	passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
	if err != nil {
		return fmt.Errorf("failed to read password: %w", err)
	}
	password := string(passwordBytes)
	fmt.Println()

	fmt.Print(theme.PromptStyle.Render("Confirm Password: "))
	confirmBytes, err := term.ReadPassword(int(syscall.Stdin))
	if err != nil {
		return fmt.Errorf("failed to read password confirmation: %w", err)
	}
	confirm := string(confirmBytes)
	fmt.Println()

	if password != confirm {
		printError("Passwords do not match")
		return fmt.Errorf("passwords do not match")
	}

	// Create the admin account
	fmt.Println(theme.MutedStyle.Render("Creating admin account..."))

	user, err := client.InitializeSetup(email, password, firstName, lastName)
	if err != nil {
		printError("Failed to create admin account: " + err.Error())
		return err
	}

	printSuccess(fmt.Sprintf("Admin account created: %s", user.Email))
	printInfo("You can now login with 'rune auth login'")

	return nil
}
