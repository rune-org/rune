/*
Package components provides reusable UI components for the RUNE TUI.
*/
package components

import (
	"strings"
	"time"

	"github.com/atotto/clipboard"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/rune-org/rune-cli/internal/theme"
)

// LogoTickMsg is sent when the logo animation should update
type LogoTickMsg time.Time

// LogoAnimation provides an animated logo component
type LogoAnimation struct {
	frame    int
	maxFrame int
}

// NewLogoAnimation creates a new logo animation
func NewLogoAnimation() *LogoAnimation {
	return &LogoAnimation{
		frame:    0,
		maxFrame: 40,
	}
}

// Tick returns a command that advances the animation
func (l *LogoAnimation) Tick() tea.Cmd {
	return tea.Tick(time.Millisecond*100, func(t time.Time) tea.Msg {
		return LogoTickMsg(t)
	})
}

// Update handles the tick message
func (l *LogoAnimation) Update(msg tea.Msg) tea.Cmd {
	if _, ok := msg.(LogoTickMsg); ok {
		l.frame++
		if l.frame > l.maxFrame {
			l.frame = l.maxFrame
		}
		return l.Tick()
	}
	return nil
}

// View renders the animated logo
func (l *LogoAnimation) View(frame int) string {
	// The logo frames - progressively revealing the RUNE logo
	logoFull := []string{
		"",
		"          ██████╗  ██╗   ██╗ ███╗   ██╗ ███████╗",
		"          ██╔══██╗ ██║   ██║ ████╗  ██║ ██╔════╝",
		"          ██████╔╝ ██║   ██║ ██╔██╗ ██║ █████╗  ",
		"          ██╔══██╗ ██║   ██║ ██║╚██╗██║ ██╔══╝  ",
		"          ██║  ╚██╗╚██████╔╝ ██║ ╚████║ ███████╗",
		"          ╚═╝   ╚═╝ ╚═════╝  ╚═╝  ╚═══╝ ╚══════╝",
		"",
	}

	var b strings.Builder

	// Calculate animation progress
	progress := float64(frame) / float64(20)
	if progress > 1 {
		progress = 1
	}

	// Primary color with glow effect based on frame
	primaryStyle := lipgloss.NewStyle().
		Foreground(theme.PrimaryColor).
		Bold(true)

	// Animate reveal
	revealChars := int(float64(50) * progress)

	for _, line := range logoFull {
		if len(line) <= revealChars || progress >= 1 {
			b.WriteString(primaryStyle.Render(line) + "\n")
		} else {
			visible := line[:revealChars]
			b.WriteString(primaryStyle.Render(visible) + "\n")
		}
	}

	// Tagline appears after logo
	if frame > 15 {
		taglineProgress := float64(frame-15) / float64(10)
		if taglineProgress > 1 {
			taglineProgress = 1
		}

		tagline := "       Workflow Automation Platform"
		visibleTagline := int(float64(len(tagline)) * taglineProgress)

		taglineStyle := lipgloss.NewStyle().
			Foreground(theme.SecondaryColor).
			Italic(true)

		b.WriteString("\n" + taglineStyle.Render(tagline[:visibleTagline]))
	}

	// Version appears last
	if frame > 25 {
		versionStyle := lipgloss.NewStyle().
			Foreground(theme.MutedColor)
		b.WriteString("\n\n" + versionStyle.Render("                  v"+theme.Version))
	}

	return b.String()
}

// Table is a simple table component
type Table struct {
	Headers     []string
	Rows        [][]string
	Selected    int
	Width       int
	ColumnWidth []int
}

// NewTable creates a new table
func NewTable(headers []string, width int) *Table {
	return &Table{
		Headers:  headers,
		Rows:     make([][]string, 0),
		Selected: 0,
		Width:    width,
	}
}

// SetRows sets the table data
func (t *Table) SetRows(rows [][]string) {
	t.Rows = rows
}

// View renders the table
func (t *Table) View() string {
	var b strings.Builder

	headerStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.SecondaryColor)
	cellStyle := lipgloss.NewStyle().Foreground(theme.TextColor)
	selectedStyle := lipgloss.NewStyle().Background(lipgloss.Color("#1E3A5F"))

	// Render headers
	for _, h := range t.Headers {
		b.WriteString(headerStyle.Render(h) + "  ")
	}
	b.WriteString("\n")
	b.WriteString(lipgloss.NewStyle().Foreground(theme.BorderColor).Render(strings.Repeat("─", t.Width)) + "\n")

	// Render rows
	for i, row := range t.Rows {
		rowContent := ""
		for _, cell := range row {
			rowContent += cellStyle.Render(cell) + "  "
		}

		if i == t.Selected {
			b.WriteString(selectedStyle.Render(rowContent) + "\n")
		} else {
			b.WriteString(rowContent + "\n")
		}
	}

	return b.String()
}

// StatusIndicator renders a status indicator
type StatusIndicator struct {
	Label  string
	Status string
	IsGood bool
}

// View renders the status indicator
func (s StatusIndicator) View() string {
	icon := lipgloss.NewStyle().Foreground(theme.SuccessColor).Render("●")
	if !s.IsGood {
		icon = lipgloss.NewStyle().Foreground(theme.ErrorColor).Render("●")
	}

	labelStyle := lipgloss.NewStyle().Foreground(theme.MutedColor).Width(20)
	statusStyle := lipgloss.NewStyle().Foreground(theme.TextColor)

	return icon + " " + labelStyle.Render(s.Label) + statusStyle.Render(s.Status)
}

// Card is a bordered content box
type Card struct {
	Title   string
	Content string
	Width   int
	Color   lipgloss.Color
}

// View renders the card
func (c Card) View() string {
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(c.Color)

	contentStyle := lipgloss.NewStyle().
		Foreground(theme.MutedColor)

	cardStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(c.Color).
		Padding(0, 2).
		Width(c.Width)

	return cardStyle.Render(titleStyle.Render(c.Title) + "\n" + contentStyle.Render(c.Content))
}

// Clipboard provides clipboard utilities
type Clipboard struct{}

// Copy copies text to the system clipboard
func (Clipboard) Copy(text string) error {
	return clipboard.WriteAll(text)
}

// Paste retrieves text from the system clipboard
func (Clipboard) Paste() (string, error) {
	return clipboard.ReadAll()
}

// CopyToClipboard is a convenience function for copying to clipboard
func CopyToClipboard(text string) error {
	return clipboard.WriteAll(text)
}

// PasteFromClipboard is a convenience function for pasting from clipboard
func PasteFromClipboard() (string, error) {
	return clipboard.ReadAll()
}
