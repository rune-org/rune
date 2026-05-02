/*
Package cli - users.go provides user management commands.

All user commands require admin authentication and use the HTTP API.

Commands:
  - rune users list          List all users
  - rune users get <id>      Get user details
  - rune users activate <id> Activate a user
  - rune users deactivate <id> Deactivate a user
*/
package cli

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/rune-org/rune-cli/internal/helpers"
	"github.com/rune-org/rune-cli/internal/theme"
)

var usersCmd = &cobra.Command{
	Use:   "users",
	Short: "User management (admin only)",
	Long:  "Manage RUNE platform users. Requires admin privileges.",
	PersistentPreRunE: requireAdmin,
}

var usersListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all users",
	RunE:  runUsersList,
}

var usersGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Get user details",
	Args:  cobra.ExactArgs(1),
	RunE:  runUsersGet,
}

var usersActivateCmd = &cobra.Command{
	Use:   "activate <id>",
	Short: "Activate a user",
	Args:  cobra.ExactArgs(1),
	RunE:  runUsersActivate,
}

var usersDeactivateCmd = &cobra.Command{
	Use:   "deactivate <id>",
	Short: "Deactivate a user",
	Args:  cobra.ExactArgs(1),
	RunE:  runUsersDeactivate,
}

func init() {
	usersCmd.AddCommand(usersListCmd)
	usersCmd.AddCommand(usersGetCmd)
	usersCmd.AddCommand(usersActivateCmd)
	usersCmd.AddCommand(usersDeactivateCmd)
}

func runUsersList(cmd *cobra.Command, args []string) error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	users, err := client.ListUsers()
	if err != nil {
		printError("Failed to list users: " + err.Error())
		return err
	}

	if outputJSON {
		data, _ := json.MarshalIndent(users, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	fmt.Println(theme.SectionHeader("Users"))

	if len(users) == 0 {
		printInfo("No users found")
		return nil
	}

	// Print table header
	fmt.Printf("  %-5s %-30s %-10s %-10s %s\n",
		theme.Bold.Render("ID"),
		theme.Bold.Render("Email"),
		theme.Bold.Render("Role"),
		theme.Bold.Render("Status"),
		theme.Bold.Render("Provider"))
	fmt.Println("  " + strings.Repeat("-", 75))

	for _, u := range users {
		status := theme.SuccessStyle.Render("Active")
		if !u.IsActive {
			status = theme.MutedStyle.Render("Inactive")
		}

		role := u.Role
		if role == "admin" {
			role = theme.WarningStyle.Render("ADMIN")
		}

		email := helpers.TruncateString(u.Email, 28)

		fmt.Printf("  %-5d %-30s %-10s %-10s %s\n",
			u.ID, email, role, status, u.AuthProvider)
	}

	fmt.Printf("\n%s\n", theme.MutedStyle.Render(fmt.Sprintf("Total: %d users", len(users))))

	return nil
}

func runUsersGet(cmd *cobra.Command, args []string) error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	userID, err := helpers.ParseID(args[0])
	if err != nil {
		printError(err.Error())
		return err
	}

	user, err := client.GetUser(userID)
	if err != nil {
		printError("Failed to get user: " + err.Error())
		return err
	}

	if outputJSON {
		data, _ := json.MarshalIndent(user, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	fmt.Println(theme.SectionHeader("User Details"))

	fmt.Printf("  %s %d\n", theme.MutedStyle.Render("ID:"), user.ID)
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Email:"), user.Email)
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Name:"), user.FirstName+" "+user.LastName)
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Role:"), strings.ToUpper(user.Role))

	status := theme.SuccessStyle.Render("Active")
	if !user.IsActive {
		status = theme.MutedStyle.Render("Inactive")
	}
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Status:"), status)

	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Auth Provider:"), user.AuthProvider)
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Created:"), user.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Updated:"), user.UpdatedAt.Format("2006-01-02 15:04:05"))

	return nil
}

func runUsersActivate(cmd *cobra.Command, args []string) error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	userID, err := helpers.ParseID(args[0])
	if err != nil {
		printError(err.Error())
		return err
	}

	user, err := client.SetUserStatus(userID, true)
	if err != nil {
		printError("Failed to activate user: " + err.Error())
		return err
	}

	printSuccess(fmt.Sprintf("User %s activated", user.Email))
	return nil
}

func runUsersDeactivate(cmd *cobra.Command, args []string) error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	userID, err := helpers.ParseID(args[0])
	if err != nil {
		printError(err.Error())
		return err
	}

	user, err := client.SetUserStatus(userID, false)
	if err != nil {
		printError("Failed to deactivate user: " + err.Error())
		return err
	}

	printSuccess(fmt.Sprintf("User %s deactivated", user.Email))
	return nil
}
