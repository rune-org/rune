/*
Package cli provides the command-line interface for RUNE CLI.

This package uses Cobra for command management. When run without arguments,
it launches the interactive TUI. Commands are available for scripting and automation.

Commands are organized into groups:
  - auth: Authentication (login, logout, status) — no auth required
  - config: Configuration management — no auth required
  - db: Database operations (admin only) — requires admin auth
  - users: User management (admin only) — requires admin auth
  - workflows: Workflow operations — requires auth
*/
package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/rune-org/rune-cli/internal/config"
	"github.com/rune-org/rune-cli/internal/theme"
	"github.com/rune-org/rune-cli/internal/tui"
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
	Short: "RUNE - Workflow Automation Platform Admin Console",
	Long: `RUNE Admin Console - A powerful terminal interface for managing
the RUNE Workflow Automation Platform.

Run without arguments to launch the interactive TUI, or use
subcommands for scripted operations.`,
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		// Load configuration
		_, _ = config.Load()
	},
	Run: func(cmd *cobra.Command, args []string) {
		// Launch TUI directly when no subcommand is provided
		if err := tui.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}
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
	rootCmd.AddCommand(authCmd)     // No auth required
	rootCmd.AddCommand(configCmd)   // No auth required
	rootCmd.AddCommand(dbCmd)       // Admin auth required (set in db.go)
	rootCmd.AddCommand(usersCmd)    // Admin auth required (set in users.go)
	rootCmd.AddCommand(workflowsCmd) // Auth required (set in workflows.go)
	rootCmd.AddCommand(versionCmd)  // No auth required
	rootCmd.AddCommand(tuiCmd)      // No auth required (TUI handles its own auth)
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

// tuiCmd launches the interactive TUI mode (kept for backward compatibility)
var tuiCmd = &cobra.Command{
	Use:   "tui",
	Short: "Launch interactive TUI mode",
	Long:  "Start the full-screen interactive terminal user interface.",
	RunE: func(cmd *cobra.Command, args []string) error {
		return tui.Run()
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
