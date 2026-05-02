/*
Package cli - db.go provides database inspection and cleanup commands.

All commands require admin authentication and operate through the
RUNE API (/cli/db/*). For emergency situations (API down), the
--direct flag allows direct database access using a connection string.

Commands:
  - rune db health     Check database connection and status
  - rune db tables     List all database tables with statistics
  - rune db truncate   Truncate a specific table (keeps schema)
*/
package cli

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/rune-org/rune-cli/internal/api"
	"github.com/rune-org/rune-cli/internal/config"
	"github.com/rune-org/rune-cli/internal/db"
	"github.com/rune-org/rune-cli/internal/theme"
)

// directDB enables direct database access (emergency mode)
var directDB bool

var dbCmd = &cobra.Command{
	Use:   "db",
	Short: "Database operations (admin only)",
	Long: `Database inspection and cleanup. Requires admin authentication.

All operations go through the RUNE API which handles authentication
and authorization. For emergency access when the API is unavailable,
use the --direct flag with a configured database URL.

Data manipulation should be done through the domain commands
(workflows, users, etc.) — not via direct DB access.`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		if directDB {
			printWarning("DIRECT database access — bypassing API authentication")
			return nil
		}
		return requireAdmin(cmd, args)
	},
}

var dbHealthCmd = &cobra.Command{
	Use:   "health",
	Short: "Check database connection and status",
	RunE:  runDBHealth,
}

var dbTablesCmd = &cobra.Command{
	Use:   "tables",
	Short: "List all database tables",
	RunE:  runDBTables,
}

var dbTruncateCmd = &cobra.Command{
	Use:   "truncate <table-name>",
	Short: "Truncate a table (delete data, keep schema)",
	Long:  "Remove all rows from a specific table. Schema is preserved.",
	Args:  cobra.ExactArgs(1),
	RunE:  runDBTruncate,
}

func init() {
	dbCmd.PersistentFlags().BoolVar(&directDB, "direct", false,
		"Direct database access (emergency mode, bypasses API)")

	dbCmd.AddCommand(dbHealthCmd)
	dbCmd.AddCommand(dbTablesCmd)
	dbCmd.AddCommand(dbTruncateCmd)

	dbTruncateCmd.Flags().BoolP("force", "f", false, "Skip confirmation prompt")
}

// ─── Health ──────────────────────────────────────────────────────

func runDBHealth(cmd *cobra.Command, args []string) error {
	if directDB {
		return runDBHealthDirect()
	}
	return runDBHealthAPI()
}

func runDBHealthAPI() error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	health, err := client.DBHealth()
	if err != nil {
		printError("Health check failed: " + err.Error())
		return err
	}

	if outputJSON {
		data, _ := json.MarshalIndent(health, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	fmt.Println(theme.SectionHeader("Database Health"))
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Status:"), theme.SuccessStyle.Render("Connected"))
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Database:"), health.DatabaseName)
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Size:"), health.DatabaseSize)
	fmt.Printf("  %s %.1fms\n", theme.MutedStyle.Render("Latency:"), health.LatencyMs)
	fmt.Printf("  %s %d\n", theme.MutedStyle.Render("Tables:"), health.TableCount)

	if health.UserCount >= 0 {
		fmt.Printf("  %s %d\n", theme.MutedStyle.Render("Users:"), health.UserCount)
	}
	if health.WorkflowCount >= 0 {
		fmt.Printf("  %s %d\n", theme.MutedStyle.Render("Workflows:"), health.WorkflowCount)
	}

	version := health.Version
	if len(version) > 60 {
		version = version[:60] + "..."
	}
	fmt.Printf("  %s\n    %s\n", theme.MutedStyle.Render("Version:"), theme.DimStyle.Render(version))

	return nil
}

func runDBHealthDirect() error {
	connStr, err := getDBConnection()
	if err != nil {
		return err
	}

	pool, err := db.Connect(connStr)
	if err != nil {
		printError("Failed to connect: " + err.Error())
		return err
	}
	defer pool.Close()

	health, err := db.CheckHealth(pool)
	if err != nil {
		printError("Health check failed: " + err.Error())
		return err
	}

	if outputJSON {
		data, _ := json.MarshalIndent(health, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	fmt.Println(theme.SectionHeader("Database Health (Direct)"))
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Status:"), theme.SuccessStyle.Render("Connected"))
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Database:"), health.DatabaseName)
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Size:"), health.DatabaseSize)
	fmt.Printf("  %s %s\n", theme.MutedStyle.Render("Latency:"), health.Latency.String())
	fmt.Printf("  %s %d\n", theme.MutedStyle.Render("Tables:"), health.TableCount)

	version := health.Version
	if len(version) > 60 {
		version = version[:60] + "..."
	}
	fmt.Printf("  %s\n    %s\n", theme.MutedStyle.Render("Version:"), theme.DimStyle.Render(version))

	return nil
}

// ─── Tables ─────────────────────────────────────────────────────

func runDBTables(cmd *cobra.Command, args []string) error {
	if directDB {
		return runDBTablesDirect()
	}
	return runDBTablesAPI()
}

func runDBTablesAPI() error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	tables, err := client.DBListTables()
	if err != nil {
		printError("Failed to list tables: " + err.Error())
		return err
	}

	if outputJSON {
		data, _ := json.MarshalIndent(tables, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	fmt.Println(theme.SectionHeader("Database Tables"))
	if len(tables) == 0 {
		printInfo("No tables found")
		return nil
	}

	fmt.Printf("  %-30s %10s %12s\n",
		theme.Bold.Render("Table"),
		theme.Bold.Render("Rows"),
		theme.Bold.Render("Size"))
	fmt.Println("  " + strings.Repeat("-", 54))

	for _, t := range tables {
		fmt.Printf("  %-30s %10d %12s\n", t.Name, t.RowCount, t.SizeHuman)
	}
	return nil
}

func runDBTablesDirect() error {
	connStr, err := getDBConnection()
	if err != nil {
		return err
	}

	pool, err := db.Connect(connStr)
	if err != nil {
		printError("Failed to connect: " + err.Error())
		return err
	}
	defer pool.Close()

	tables, err := db.ListTables(pool)
	if err != nil {
		printError("Failed to list tables: " + err.Error())
		return err
	}

	if outputJSON {
		data, _ := json.MarshalIndent(tables, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	fmt.Println(theme.SectionHeader("Database Tables (Direct)"))
	if len(tables) == 0 {
		printInfo("No tables found")
		return nil
	}

	fmt.Printf("  %-30s %10s %12s\n",
		theme.Bold.Render("Table"),
		theme.Bold.Render("Rows"),
		theme.Bold.Render("Size"))
	fmt.Println("  " + strings.Repeat("-", 54))

	for _, t := range tables {
		fmt.Printf("  %-30s %10d %12s\n", t.Name, t.RowCount, t.SizeHuman)
	}
	return nil
}

// ─── Truncate ───────────────────────────────────────────────────

func runDBTruncate(cmd *cobra.Command, args []string) error {
	tableName := args[0]
	force, _ := cmd.Flags().GetBool("force")

	if !force {
		printWarning(fmt.Sprintf("This will delete ALL DATA from '%s'", tableName))
		fmt.Print(theme.WarningStyle.Render("Type the table name to confirm: "))

		reader := bufio.NewReader(os.Stdin)
		confirmation, _ := reader.ReadString('\n')
		confirmation = strings.TrimSpace(confirmation)

		if confirmation != tableName {
			printInfo("Operation cancelled")
			return nil
		}
	}

	if directDB {
		return runDBTruncateDirect(tableName)
	}
	return runDBTruncateAPI(tableName)
}

func runDBTruncateAPI(tableName string) error {
	client, err := getAuthenticatedClient()
	if err != nil {
		return err
	}

	if err := client.DBTruncateTable(tableName); err != nil {
		printError("Truncate failed: " + err.Error())
		return err
	}

	printSuccess(fmt.Sprintf("Table '%s' truncated", tableName))
	return nil
}

func runDBTruncateDirect(tableName string) error {
	connStr, err := getDBConnection()
	if err != nil {
		return err
	}

	pool, err := db.Connect(connStr)
	if err != nil {
		printError("Failed to connect: " + err.Error())
		return err
	}
	defer pool.Close()

	if err := db.TruncateTable(pool, tableName); err != nil {
		printError("Truncate failed: " + err.Error())
		return err
	}

	printSuccess(fmt.Sprintf("Table '%s' truncated", tableName))
	return nil
}

// ─── Helpers ────────────────────────────────────────────────────

func getDBConnection() (string, error) {
	cfg := config.Get()
	if cfg.DatabaseURL == "" {
		printError("Database URL not configured")
		printInfo("Use 'rune config set-db <connection-string>'")
		return "", fmt.Errorf("database URL not configured")
	}
	return cfg.DatabaseURL, nil
}

func getAuthenticatedClient() (*api.Client, error) {
	if !config.IsAuthenticated() {
		printError("Not authenticated")
		printInfo("Run 'rune auth login' first")
		return nil, fmt.Errorf("not authenticated")
	}
	return api.NewClientFromConfig(), nil
}
