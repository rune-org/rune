/*
Package db provides direct PostgreSQL database access.

This package is used for administrative operations that need to bypass
the API, such as database resets, migrations, and emergency recovery.

Usage:

	pool, err := db.Connect("postgres://user:pass@localhost/rune")
	defer pool.Close()

	health, err := db.CheckHealth(pool)

Security Note:

	Direct database access bypasses all API authentication and authorization.
	Only use for administrative operations when the API is unavailable or
	for maintenance tasks.
*/
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// HealthInfo contains database health check results
type HealthInfo struct {
	Connected     bool
	Version       string
	DatabaseName  string
	DatabaseSize  string
	TableCount    int
	UserCount     int
	WorkflowCount int
	Latency       time.Duration
}

// TableInfo contains information about a database table
type TableInfo struct {
	Name      string
	RowCount  int64
	SizeBytes int64
	SizeHuman string
}

// Connect establishes a connection pool to the PostgreSQL database
func Connect(connString string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("invalid connection string: %w", err)
	}

	config.MaxConns = 5
	config.MinConns = 1
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return pool, nil
}

// CheckHealth performs a comprehensive health check on the database
func CheckHealth(pool *pgxpool.Pool) (*HealthInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	info := &HealthInfo{Connected: true}

	start := time.Now()

	// Get PostgreSQL version
	err := pool.QueryRow(ctx, "SELECT version()").Scan(&info.Version)
	if err != nil {
		return nil, fmt.Errorf("failed to get version: %w", err)
	}

	info.Latency = time.Since(start)

	// Get database name
	err = pool.QueryRow(ctx, "SELECT current_database()").Scan(&info.DatabaseName)
	if err != nil {
		return nil, fmt.Errorf("failed to get database name: %w", err)
	}

	// Get database size
	err = pool.QueryRow(ctx,
		"SELECT pg_size_pretty(pg_database_size(current_database()))").Scan(&info.DatabaseSize)
	if err != nil {
		info.DatabaseSize = "unknown"
	}

	// Count tables
	err = pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'").Scan(&info.TableCount)
	if err != nil {
		info.TableCount = -1
	}

	// Count users (if table exists)
	err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM \"user\"").Scan(&info.UserCount)
	if err != nil {
		info.UserCount = -1
	}

	// Count workflows (if table exists)
	err = pool.QueryRow(ctx, "SELECT COUNT(*) FROM workflow").Scan(&info.WorkflowCount)
	if err != nil {
		info.WorkflowCount = -1
	}

	return info, nil
}

// ListTables returns information about all tables in the public schema
func ListTables(pool *pgxpool.Pool) ([]TableInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		SELECT 
			t.table_name,
			COALESCE(s.n_live_tup, 0) as row_count,
			COALESCE(pg_total_relation_size(quote_ident(t.table_name)::regclass), 0) as size_bytes,
			COALESCE(pg_size_pretty(pg_total_relation_size(quote_ident(t.table_name)::regclass)), '0 bytes') as size_human
		FROM information_schema.tables t
		LEFT JOIN pg_stat_user_tables s ON t.table_name = s.relname
		WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
		ORDER BY t.table_name
	`

	rows, err := pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list tables: %w", err)
	}
	defer rows.Close()

	var tables []TableInfo
	for rows.Next() {
		var t TableInfo
		if err := rows.Scan(&t.Name, &t.RowCount, &t.SizeBytes, &t.SizeHuman); err != nil {
			continue
		}
		tables = append(tables, t)
	}

	return tables, rows.Err()
}

// ResetDatabase drops all tables and recreates the schema
// WARNING: This is a destructive operation that cannot be undone
func ResetDatabase(pool *pgxpool.Pool) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Get all table names
	tables, err := ListTables(pool)
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}

	// Drop all tables in a transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Disable foreign key checks temporarily
	_, err = tx.Exec(ctx, "SET session_replication_role = 'replica'")
	if err != nil {
		return fmt.Errorf("failed to disable foreign key checks: %w", err)
	}

	// Drop each table
	for _, table := range tables {
		_, err = tx.Exec(ctx, fmt.Sprintf("DROP TABLE IF EXISTS %q CASCADE", table.Name))
		if err != nil {
			return fmt.Errorf("failed to drop table %s: %w", table.Name, err)
		}
	}

	// Re-enable foreign key checks
	_, err = tx.Exec(ctx, "SET session_replication_role = 'origin'")
	if err != nil {
		return fmt.Errorf("failed to re-enable foreign key checks: %w", err)
	}

	// Also drop alembic version table if exists
	_, _ = tx.Exec(ctx, "DROP TABLE IF EXISTS alembic_version CASCADE")

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// TruncateAllTables removes all data but keeps the schema
func TruncateAllTables(pool *pgxpool.Pool) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	tables, err := ListTables(pool)
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Disable foreign key checks
	_, err = tx.Exec(ctx, "SET session_replication_role = 'replica'")
	if err != nil {
		return fmt.Errorf("failed to disable foreign key checks: %w", err)
	}

	for _, table := range tables {
		if table.Name == "alembic_version" {
			continue // Don't truncate migration tracking
		}
		_, err = tx.Exec(ctx, fmt.Sprintf("TRUNCATE TABLE %q CASCADE", table.Name))
		if err != nil {
			return fmt.Errorf("failed to truncate table %s: %w", table.Name, err)
		}
	}

	// Re-enable foreign key checks
	_, err = tx.Exec(ctx, "SET session_replication_role = 'origin'")
	if err != nil {
		return fmt.Errorf("failed to re-enable foreign key checks: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// TruncateTable truncates a single table by name (data only, schema preserved).
func TruncateTable(pool *pgxpool.Pool, tableName string) error {
	if tableName == "alembic_version" {
		return fmt.Errorf("cannot truncate migration tracking table")
	}

	// Validate table exists
	tables, err := ListTables(pool)
	if err != nil {
		return fmt.Errorf("failed to list tables: %w", err)
	}
	found := false
	for _, t := range tables {
		if t.Name == tableName {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("table '%s' not found", tableName)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, "SET session_replication_role = 'replica'")
	if err != nil {
		return fmt.Errorf("failed to disable foreign key checks: %w", err)
	}

	_, err = tx.Exec(ctx, fmt.Sprintf("TRUNCATE TABLE %q CASCADE", tableName))
	if err != nil {
		return fmt.Errorf("failed to truncate table %s: %w", tableName, err)
	}

	_, err = tx.Exec(ctx, "SET session_replication_role = 'origin'")
	if err != nil {
		return fmt.Errorf("failed to re-enable foreign key checks: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// ExecuteSQL runs a raw SQL query and returns the results
func ExecuteSQL(pool *pgxpool.Pool, query string) ([]map[string]any, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	rows, err := pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	fieldDescriptions := rows.FieldDescriptions()
	var results []map[string]any

	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, fmt.Errorf("failed to read row: %w", err)
		}

		row := make(map[string]any)
		for i, fd := range fieldDescriptions {
			row[string(fd.Name)] = values[i]
		}
		results = append(results, row)
	}

	return results, rows.Err()
}

// CountUsers returns the number of users in the database
func CountUsers(pool *pgxpool.Pool) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var count int
	err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM "user"`).Scan(&count)
	if err != nil {
		if err == pgx.ErrNoRows {
			return 0, nil
		}
		return 0, err
	}
	return count, nil
}

// GetConnectionStats returns connection pool statistics
func GetConnectionStats(pool *pgxpool.Pool) map[string]any {
	stat := pool.Stat()
	return map[string]any{
		"total_conns":          stat.TotalConns(),
		"acquired_conns":       stat.AcquiredConns(),
		"idle_conns":           stat.IdleConns(),
		"max_conns":            stat.MaxConns(),
		"constructing_conns":   stat.ConstructingConns(),
		"new_conns_count":      stat.NewConnsCount(),
		"max_lifetime_destroy": stat.MaxLifetimeDestroyCount(),
		"max_idle_destroy":     stat.MaxIdleDestroyCount(),
	}
}
