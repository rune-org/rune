/*
Package main is the entry point for the RUNE CLI application.

The RUNE CLI provides both an interactive TUI mode and traditional
command-line interface for managing the RUNE Workflow Automation Platform.

Usage:
  - Run without arguments to start the interactive TUI
  - Run with commands for non-interactive operations
  - Use --help for command documentation

Build:

	go build -o rune ./cmd/rune

Run:

	./rune              # Start interactive TUI
	./rune --help       # Show help
	./rune db health    # Check database connection
*/
package main

import (
	"os"

	"github.com/rune-org/rune-cli/internal/cli"
)

// Version information injected at build time
var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

func main() {
	cli.SetVersionInfo(version, commit, date)

	if err := cli.Execute(); err != nil {
		os.Exit(1)
	}
}
