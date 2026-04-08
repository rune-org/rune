/*
Package theme provides visual styling for the RUNE CLI.

This package defines the color palette, styles, and ASCII art logos
that create a consistent, branded experience across all CLI interfaces.

The color scheme is inspired by the RUNE web application and uses
blues and cyans as primary colors with appropriate contrast for
terminal readability.
*/
package theme

import "github.com/charmbracelet/lipgloss"

// Color palette for the RUNE CLI
// These colors are designed to work well on both light and dark terminals
var (
	// Primary brand colors
	PrimaryColor   = lipgloss.Color("#3B82F6") // Blue 500
	SecondaryColor = lipgloss.Color("#06B6D4") // Cyan 500
	AccentColor    = lipgloss.Color("#8B5CF6") // Purple 500

	// Status colors
	SuccessColor = lipgloss.Color("#10B981") // Green 500
	WarningColor = lipgloss.Color("#F59E0B") // Amber 500
	ErrorColor   = lipgloss.Color("#EF4444") // Red 500
	InfoColor    = lipgloss.Color("#3B82F6") // Blue 500

	// Neutral colors
	TextColor       = lipgloss.Color("#F8FAFC") // Slate 50
	MutedColor      = lipgloss.Color("#94A3B8") // Slate 400
	DimColor        = lipgloss.Color("#64748B") // Slate 500
	BackgroundColor = lipgloss.Color("#0F172A") // Slate 900
	BorderColor     = lipgloss.Color("#334155") // Slate 700
)

// Adaptive colors that work on both light and dark terminals
var (
	AdaptivePrimary = lipgloss.AdaptiveColor{Light: "#2563EB", Dark: "#60A5FA"}
	AdaptiveText    = lipgloss.AdaptiveColor{Light: "#1E293B", Dark: "#F8FAFC"}
	AdaptiveMuted   = lipgloss.AdaptiveColor{Light: "#64748B", Dark: "#94A3B8"}
)
