/*
Package theme - styles.go provides Lip Gloss style definitions.

These styles are reusable components for building consistent UI
elements throughout the CLI application.
*/
package theme

import "github.com/charmbracelet/lipgloss"

// Base styles for common UI patterns
var (
	// Bold text style
	Bold = lipgloss.NewStyle().Bold(true)

	// Italic text style
	Italic = lipgloss.NewStyle().Italic(true)

	// Underline text style
	Underline = lipgloss.NewStyle().Underline(true)
)

// Text styles for different content types
var (
	// Title style for main headers
	TitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(PrimaryColor).
			MarginBottom(1)

	// Subtitle style for secondary headers
	SubtitleStyle = lipgloss.NewStyle().
			Foreground(SecondaryColor).
			MarginBottom(1)

	// Normal text style
	TextStyle = lipgloss.NewStyle().
			Foreground(AdaptiveText)

	// Muted text for less important information
	MutedStyle = lipgloss.NewStyle().
			Foreground(MutedColor)

	// Dim text for hints and secondary content
	DimStyle = lipgloss.NewStyle().
			Foreground(DimColor)
)

// Status indicator styles
var (
	// Success message style (green)
	SuccessStyle = lipgloss.NewStyle().
			Foreground(SuccessColor)

	// Warning message style (amber)
	WarningStyle = lipgloss.NewStyle().
			Foreground(WarningColor)

	// Error message style (red)
	ErrorStyle = lipgloss.NewStyle().
			Foreground(ErrorColor)

	// Info message style (blue)
	InfoStyle = lipgloss.NewStyle().
			Foreground(InfoColor)
)

// Status badges with icons
var (
	SuccessBadge = lipgloss.NewStyle().
			Foreground(SuccessColor).
			SetString("● ")

	WarningBadge = lipgloss.NewStyle().
			Foreground(WarningColor).
			SetString("● ")

	ErrorBadge = lipgloss.NewStyle().
			Foreground(ErrorColor).
			SetString("● ")

	InfoBadge = lipgloss.NewStyle().
			Foreground(InfoColor).
			SetString("● ")
)

// Container styles for layout
var (
	// Panel style with border
	PanelStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(BorderColor).
			Padding(1, 2)

	// Highlighted panel with primary color border
	HighlightPanelStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(PrimaryColor).
				Padding(1, 2)

	// Box style for grouped content
	BoxStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder()).
			BorderForeground(BorderColor).
			Padding(0, 1)
)

// Interactive element styles
var (
	// Selected item in a list
	SelectedStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true)

	// Cursor indicator
	CursorStyle = lipgloss.NewStyle().
			Foreground(SecondaryColor).
			SetString("▸ ")

	// Active/focused element
	ActiveStyle = lipgloss.NewStyle().
			Foreground(PrimaryColor).
			Bold(true)

	// Inactive/unfocused element
	InactiveStyle = lipgloss.NewStyle().
			Foreground(MutedColor)
)

// Table styles for data display
var (
	// Table header style
	TableHeaderStyle = lipgloss.NewStyle().
				Bold(true).
				Foreground(PrimaryColor).
				BorderBottom(true).
				BorderStyle(lipgloss.NormalBorder()).
				BorderForeground(BorderColor)

	// Table cell style
	TableCellStyle = lipgloss.NewStyle().
			Padding(0, 1)

	// Table row selected style
	TableSelectedRowStyle = lipgloss.NewStyle().
				Background(lipgloss.Color("#1E3A5F")).
				Foreground(TextColor)
)

// Help and documentation styles
var (
	// Help key style (the key combination)
	HelpKeyStyle = lipgloss.NewStyle().
			Foreground(SecondaryColor).
			Bold(true)

	// Help description style
	HelpDescStyle = lipgloss.NewStyle().
			Foreground(MutedColor)

	// Help separator
	HelpSepStyle = lipgloss.NewStyle().
			Foreground(DimColor).
			SetString(" │ ")
)

// Input and form styles
var (
	// Input prompt style
	PromptStyle = lipgloss.NewStyle().
			Foreground(SecondaryColor).
			Bold(true)

	// Input placeholder style
	PlaceholderStyle = lipgloss.NewStyle().
				Foreground(DimColor)

	// Input focused style
	FocusedInputStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(PrimaryColor)

	// Input blurred style
	BlurredInputStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(BorderColor)
)

// StatusBar returns a styled status bar for the bottom of the screen
func StatusBar(width int) lipgloss.Style {
	return lipgloss.NewStyle().
		Background(lipgloss.Color("#1E293B")).
		Foreground(TextColor).
		Padding(0, 1).
		Width(width)
}

// Header returns a styled header for the top of the screen
func Header(width int) lipgloss.Style {
	return lipgloss.NewStyle().
		Background(lipgloss.Color("#1E3A5F")).
		Foreground(TextColor).
		Bold(true).
		Padding(0, 2).
		Width(width)
}
