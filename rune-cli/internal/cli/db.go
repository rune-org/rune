/*
Package cli - db.go provides database management commands.

These commands use direct database access for administrative operations.
The database connection string must be configured first.

Commands:
  - rune db health     Check database connection and status
  - rune db tables     List all database tables with statistics
  - rune db reset      Reset database (drops all tables)
  - rune db truncate   Truncate all tables (keeps schema)
  - rune db sql        Execute a raw SQL query
*/
package cli

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/rune-org/rune-cli/internal/config"
	"github.com/rune-org/rune-cli/internal/db"
	"github.com/rune-org/rune-cli/internal/theme"
)

var dbCmd = &cobra.Command{
	Use:   "db",
	Short: "Database operations",
	Long:  "Direct database access for administrative operations.\nRequires database connection string to be configured.",
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

var dbResetCmd = &cobra.Command{
	Use:   "reset",
	Short: "Reset database (drops all tables)",
	Long:  "WARNING: This will drop all tables and data. This action cannot be undone.",
	RunE:  runDBReset,
}

var dbTruncateCmd = &cobra.Command{
	Use:   "truncate",
	Short: "Truncate all tables (keeps schema)",
	Long:  "WARNING: This will delete all data but keep the table structure.",
	RunE:  runDBTruncate,
}

var dbSQLCmd = &cobra.Command{
	Use:   "sql <query>",
	Short: "Execute a raw SQL query",
	Long:  "Execute a raw SQL query against the database.\nUse with caution!",
	Args:  cobra.ExactArgs(1),
	RunE:  runDBSQL,
}

var (
	dbForce bool
)

func init() {
	dbCmd.AddCommand(dbHealthCmd)
	dbCmd.AddCommand(dbTablesCmd)
	dbCmd.AddCommand(dbResetCmd)
	dbCmd.AddCommand(dbTruncateCmd)
	dbCmd.AddCommand(dbSQLCmd)

	dbResetCmd.Flags().BoolVarP(&dbForce, "force", "f", false, "Skip confirmation prompt")
	dbTruncateCmd.Flags().BoolVarP(&dbForce, "force", "f", false, "Skip confirmation prompt")
	dbSQLCmd.Flags().BoolVarP(&dbForce, "force", "f", false, "Skip confirmation for dangerous queries")
}

func getDBConnection() (string, error) {
	cfg := config.Get()
	if cfg.DatabaseURL == "" {
		return "", fmt.Errorf("database URL not configured. Use 'rune config set-db <connection-string>'")
	}
	return cfg.DatabaseURL, nil
}

func runDBHealth(cmd *cobra.Command, args []string) error {
	connStr, err := getDBConnection()
	if err != nil {
		printError(err.Error())
		return err
	}

	fmt.Println(theme.MutedStyle.Render("Connecting to database..."))

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

	fmt.Println(theme.SectionHeader("Database Health"))

	fmt.Printf("  %s %s\n",
		theme.MutedStyle.Render("Status:"),
		theme.SuccessStyle.Render("Connected"))

	fmt.Printf("  %s %s\n",
		theme.MutedStyle.Render("Database:"),
		health.DatabaseName)

	fmt.Printf("  %s %s\n",
		theme.MutedStyle.Render("Size:"),
		health.DatabaseSize)

	fmt.Printf("  %s %s\n",
		theme.MutedStyle.Render("Latency:"),
		health.Latency.String())

	fmt.Printf("  %s %d\n",
		theme.MutedStyle.Render("Tables:"),
		health.TableCount)

	if health.UserCount >= 0 {
		fmt.Printf("  %s %d\n",
			theme.MutedStyle.Render("Users:"),
			health.UserCount)
	}

	if health.WorkflowCount >= 0 {
		fmt.Printf("  %s %d\n",
			theme.MutedStyle.Render("Workflows:"),
			health.WorkflowCount)
	}

	// Print version (truncated)
	version := health.Version
	if len(version) > 60 {
		version = version[:60] + "..."
	}
	fmt.Printf("  %s\n    %s\n",
		theme.MutedStyle.Render("Version:"),
		theme.DimStyle.Render(version))

	return nil
}

func runDBTables(cmd *cobra.Command, args []string) error {
	connStr, err := getDBConnection()
	if err != nil {
		printError(err.Error())
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

	fmt.Println(theme.SectionHeader("Database Tables"))

	if len(tables) == 0 {
		printInfo("No tables found in database")
		return nil
	}

	// Print table header
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

func runDBReset(cmd *cobra.Command, args []string) error {
	connStr, err := getDBConnection()
	if err != nil {
		printError(err.Error())
		return err
	}

	if !dbForce {
		printWarning("This will DROP ALL TABLES and delete ALL DATA!")
		printWarning("This action cannot be undone!")
		fmt.Println()
		fmt.Print(theme.ErrorStyle.Render("Type 'RESET' to confirm: "))

		reader := bufio.NewReader(os.Stdin)
		confirmation, _ := reader.ReadString('\n')
		confirmation = strings.TrimSpace(confirmation)

		if confirmation != "RESET" {
			printInfo("Operation cancelled")
			return nil
		}
	}

	fmt.Println(theme.MutedStyle.Render("Connecting to database..."))

	pool, err := db.Connect(connStr)
	if err != nil {
		printError("Failed to connect: " + err.Error())
		return err
	}
	defer pool.Close()

	fmt.Println(theme.MutedStyle.Render("Dropping all tables..."))

	if err := db.ResetDatabase(pool); err != nil {
		printError("Reset failed: " + err.Error())
		return err
	}

	printSuccess("Database reset complete")
	printInfo("Run migrations to recreate the schema")
	return nil
}

func runDBTruncate(cmd *cobra.Command, args []string) error {
	connStr, err := getDBConnection()
	if err != nil {
		printError(err.Error())
		return err
	}

	if !dbForce {
		printWarning("This will DELETE ALL DATA but keep the table structure!")
		fmt.Println()
		fmt.Print(theme.WarningStyle.Render("Type 'TRUNCATE' to confirm: "))

		reader := bufio.NewReader(os.Stdin)
		confirmation, _ := reader.ReadString('\n')
		confirmation = strings.TrimSpace(confirmation)

		if confirmation != "TRUNCATE" {
			printInfo("Operation cancelled")
			return nil
		}
	}

	pool, err := db.Connect(connStr)
	if err != nil {
		printError("Failed to connect: " + err.Error())
		return err
	}
	defer pool.Close()

	fmt.Println(theme.MutedStyle.Render("Truncating all tables..."))

	if err := db.TruncateAllTables(pool); err != nil {
		printError("Truncate failed: " + err.Error())
		return err
	}

	printSuccess("All tables truncated")
	return nil
}

func runDBSQL(cmd *cobra.Command, args []string) error {
	query := args[0]
	queryLower := strings.ToLower(query)

	// Check for dangerous operations
	isDangerous := strings.Contains(queryLower, "drop") ||
		strings.Contains(queryLower, "delete") ||
		strings.Contains(queryLower, "truncate") ||
		strings.Contains(queryLower, "update")

	if isDangerous && !dbForce {
		printWarning("This query may modify or delete data!")
		fmt.Println()
		fmt.Print(theme.WarningStyle.Render("Continue? (yes/no): "))

		reader := bufio.NewReader(os.Stdin)
		confirmation, _ := reader.ReadString('\n')
		confirmation = strings.TrimSpace(strings.ToLower(confirmation))

		if confirmation != "yes" && confirmation != "y" {
			printInfo("Operation cancelled")
			return nil
		}
	}

	connStr, err := getDBConnection()
	if err != nil {
		printError(err.Error())
		return err
	}

	pool, err := db.Connect(connStr)
	if err != nil {
		printError("Failed to connect: " + err.Error())
		return err
	}
	defer pool.Close()

	results, err := db.ExecuteSQL(pool, query)
	if err != nil {
		printError("Query failed: " + err.Error())
		return err
	}

	if outputJSON {
		data, _ := json.MarshalIndent(results, "", "  ")
		fmt.Println(string(data))
		return nil
	}

	if len(results) == 0 {
		printInfo("Query executed successfully (no rows returned)")
		return nil
	}

	// Get column names from first row
	var columns []string
	for k := range results[0] {
		columns = append(columns, k)
	}

	// Print header
	fmt.Println()
	for _, col := range columns {
		fmt.Printf("%-20s", theme.Bold.Render(col))
	}
	fmt.Println()
	fmt.Println(strings.Repeat("-", len(columns)*20))

	// Print rows
	for _, row := range results {
		for _, col := range columns {
			val := fmt.Sprintf("%v", row[col])
			if len(val) > 18 {
				val = val[:15] + "..."
			}
			fmt.Printf("%-20s", val)
		}
		fmt.Println()
	}

	fmt.Printf("\n%s\n", theme.MutedStyle.Render(fmt.Sprintf("(%d rows)", len(results))))

	return nil
}
