/*
Package cli provides the command-line interface for RUNE CLI.

This package uses Cobra for command management and provides both
interactive TUI mode (when run without arguments) and traditional
CLI commands for scripting and automation.

Commands are organized into groups:
  - auth: Authentication (login, logout, status)
  - config: Configuration management
  - db: Database operations (health, reset, tables)
  - users: User management (admin only)
  - workflows: Workflow operations
*/
package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/rune-org/rune-cli/internal/app"
	"github.com/rune-org/rune-cli/internal/config"
	"github.com/rune-org/rune-cli/internal/theme"
)

var (
	// Version info set by main.go
	version = "dev"
	commit  = "none"
	date    = "unknown"

	// Global flags
	verbose    bool
	noColor    bool
	outputJSON bool
)

// SetVersionInfo sets the version information from build flags
func SetVersionInfo(v, c, d string) {
	version = v
	commit = c
	date = d
	theme.SetVersion(v, c, d)
}

// rootCmd is the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "rune",
	Short: "RUNE CLI - Workflow Automation Platform",
	Long:  theme.WelcomeBanner() + theme.WelcomeMessage(),
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		// Load configuration
		_, _ = config.Load()
	},
	Run: func(cmd *cobra.Command, args []string) {
		// If no subcommand is provided, show the welcome banner and help
		fmt.Println(theme.WelcomeBanner())
		fmt.Println(theme.WelcomeMessage())
	},
}

// Execute runs the root command
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	// Global persistent flags
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose output")
	rootCmd.PersistentFlags().BoolVar(&noColor, "no-color", false, "Disable colored output")
	rootCmd.PersistentFlags().BoolVarP(&outputJSON, "json", "j", false, "Output in JSON format")

	// Add subcommands
	rootCmd.AddCommand(authCmd)
	rootCmd.AddCommand(configCmd)
	rootCmd.AddCommand(dbCmd)
	rootCmd.AddCommand(usersCmd)
	rootCmd.AddCommand(versionCmd)
	rootCmd.AddCommand(tuiCmd)
}

// versionCmd shows version information
var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Show version information",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("%s\n", theme.ShortWelcome())
		fmt.Printf("  Version: %s\n", version)
		fmt.Printf("  Commit:  %s\n", commit)
		fmt.Printf("  Date:    %s\n", date)
	},
}

// tuiCmd launches the interactive TUI mode
var tuiCmd = &cobra.Command{
	Use:   "tui",
	Short: "Launch interactive TUI mode",
	Long:  "Start the full-screen interactive terminal user interface.",
	RunE: func(cmd *cobra.Command, args []string) error {
		return app.Run()
	},
}

// printSuccess prints a success message
func printSuccess(msg string) {
	fmt.Printf("%s %s\n", theme.SuccessStyle.Render("✓"), msg)
}

// printError prints an error message
func printError(msg string) {
	fmt.Fprintf(os.Stderr, "%s %s\n", theme.ErrorStyle.Render("✗"), msg)
}

// printWarning prints a warning message
func printWarning(msg string) {
	fmt.Printf("%s %s\n", theme.WarningStyle.Render("!"), msg)
}

// printInfo prints an info message
func printInfo(msg string) {
	fmt.Printf("%s %s\n", theme.InfoStyle.Render("→"), msg)
}
