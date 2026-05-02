/*
Package helpers provides shared utility functions for the RUNE CLI.

These functions are used across the CLI, TUI, and other internal packages
to avoid duplication.
*/
package helpers

import (
	"fmt"
	"time"
)

// TruncateString shortens a string to maxLen characters, appending "..." if truncated.
func TruncateString(s string, maxLen int) string {
	if maxLen <= 3 {
		return s
	}
	if len(s) > maxLen {
		return s[:maxLen-3] + "..."
	}
	return s
}

// FormatRelativeTime returns a human-readable relative time string.
func FormatRelativeTime(t time.Time) string {
	now := time.Now()
	diff := now.Sub(t)

	switch {
	case diff < time.Minute:
		return "just now"
	case diff < time.Hour:
		mins := int(diff.Minutes())
		if mins == 1 {
			return "1 min ago"
		}
		return fmt.Sprintf("%d mins ago", mins)
	case diff < 24*time.Hour:
		hours := int(diff.Hours())
		if hours == 1 {
			return "1 hour ago"
		}
		return fmt.Sprintf("%d hours ago", hours)
	case diff < 7*24*time.Hour:
		days := int(diff.Hours() / 24)
		if days == 1 {
			return "yesterday"
		}
		return fmt.Sprintf("%d days ago", days)
	default:
		return t.Format("Jan 2, 2006")
	}
}

// MaskConnectionString hides sensitive parts of a database connection string.
func MaskConnectionString(connStr string) string {
	if len(connStr) > 20 {
		return connStr[:10] + "****" + connStr[len(connStr)-10:]
	}
	return "****"
}

// ParseID parses an integer ID from a string, returning a formatted error if invalid.
func ParseID(s string) (int, error) {
	var id int
	if _, err := fmt.Sscanf(s, "%d", &id); err != nil {
		return 0, fmt.Errorf("invalid ID: %s", s)
	}
	return id, nil
}
