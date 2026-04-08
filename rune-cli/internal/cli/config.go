/*
Package cli - config.go provides configuration management commands.

Commands:
  - rune config show       Display current configuration
  - rune config set-url    Set API server URL
  - rune config set-db     Set database connection string
  - rune config reset      Reset configuration to defaults
  - rune config path       Show configuration file paths
*/
package cli

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/rune-org/rune-cli/internal/config"
	"github.com/rune-org/rune-cli/internal/theme"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Configuration management",
	Long:  "View and modify CLI configuration settings.",
}

var configShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Display current configuration",
	RunE:  runConfigShow,
}

var configSetURLCmd = &cobra.Command{
	Use:   "set-url <url>",
	Short: "Set API server URL",
	Args:  cobra.ExactArgs(1),
	RunE:  runConfigSetURL,
}

var configSetDBCmd = &cobra.Command{
	Use:   "set-db <connection-string>",
	Short: "Set database connection string",
	Long:  "Set the PostgreSQL connection string for direct database access.",
	Args:  cobra.ExactArgs(1),
	RunE:  runConfigSetDB,
}

var configResetCmd = &cobra.Command{
	Use:   "reset",
	Short: "Reset configuration to defaults",
	RunE:  runConfigReset,
}

var configPathCmd = &cobra.Command{
	Use:   "path",
	Short: "Show configuration file paths",
	RunE:  runConfigPath,
}

func init() {
	configCmd.AddCommand(configShowCmd)
	configCmd.AddCommand(configSetURLCmd)
	configCmd.AddCommand(configSetDBCmd)
	configCmd.AddCommand(configResetCmd)
	configCmd.AddCommand(configPathCmd)
}

func runConfigShow(cmd *cobra.Command, args []string) error {
	cfg := config.Get()

	if outputJSON {
		data, err := json.MarshalIndent(cfg, "", "  ")
		if err != nil {
			return err
		}
		fmt.Println(string(data))
		return nil
	}

	fmt.Println(theme.SectionHeader("Configuration"))

	fmt.Printf("  %s %s\n",
		theme.MutedStyle.Render("API URL:"),
		cfg.APIURL)

	fmt.Printf("  %s %d seconds\n",
		theme.MutedStyle.Render("Timeout:"),
		cfg.Timeout)

	// Mask database URL if present
	dbURL := cfg.DatabaseURL
	if dbURL == "" {
		dbURL = theme.DimStyle.Render("(not set)")
	} else {
		dbURL = maskConnectionString(dbURL)
	}
	fmt.Printf("  %s %s\n",
		theme.MutedStyle.Render("Database URL:"),
		dbURL)

	fmt.Printf("  %s %v\n",
		theme.MutedStyle.Render("Color Enabled:"),
		cfg.ColorEnabled)

	fmt.Printf("  %s %s\n",
		theme.MutedStyle.Render("Output Format:"),
		cfg.OutputFormat)

	fmt.Printf("  %s %s\n",
		theme.MutedStyle.Render("Docker Container:"),
		cfg.DockerContainer)

	fmt.Printf("  %s %s\n",
		theme.MutedStyle.Render("Docker Network:"),
		cfg.DockerNetwork)

	return nil
}

func runConfigSetURL(cmd *cobra.Command, args []string) error {
	url := args[0]

	if err := config.SetAPIURL(url); err != nil {
		printError("Failed to save configuration: " + err.Error())
		return err
	}

	printSuccess(fmt.Sprintf("API URL set to: %s", url))
	return nil
}

func runConfigSetDB(cmd *cobra.Command, args []string) error {
	connString := args[0]

	if err := config.SetDatabaseURL(connString); err != nil {
		printError("Failed to save configuration: " + err.Error())
		return err
	}

	printSuccess("Database connection string saved")
	printWarning("Credentials are stored in plain text in the config file")
	return nil
}

func runConfigReset(cmd *cobra.Command, args []string) error {
	if err := config.Reset(); err != nil {
		printError("Failed to reset configuration: " + err.Error())
		return err
	}

	printSuccess("Configuration reset to defaults")
	return nil
}

func runConfigPath(cmd *cobra.Command, args []string) error {
	fmt.Println(theme.SectionHeader("Configuration Paths"))

	fmt.Printf("  %s\n    %s\n",
		theme.MutedStyle.Render("Config Directory:"),
		config.GetConfigDir())

	fmt.Printf("  %s\n    %s\n",
		theme.MutedStyle.Render("Config File:"),
		config.GetConfigPath())

	fmt.Printf("  %s\n    %s\n",
		theme.MutedStyle.Render("Credentials File:"),
		config.GetCredentialsPath())

	return nil
}

// maskConnectionString hides sensitive parts of a database connection string
func maskConnectionString(connStr string) string {
	// Simple masking - show only host and database
	if len(connStr) > 20 {
		return connStr[:10] + "****" + connStr[len(connStr)-10:]
	}
	return "****"
}
