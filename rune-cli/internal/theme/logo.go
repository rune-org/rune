/*
Package theme - logo.go provides ASCII art logos and branding elements.

The logos are designed to match the RUNE brand identity with the distinctive
runic "R" design inspired by the SVG logo. The logos work across different
terminal sizes and color capabilities.
*/
package theme

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// Version information (set at build time)
var (
	Version = "dev"
	Commit  = "none"
	Date    = "unknown"
)

// SetVersion updates the version information displayed in logos
func SetVersion(version, commit, date string) {
	Version = version
	Commit = commit
	Date = date
}

// RunicR returns the distinctive RUNE "R" logo matching the SVG design
// The R has a diagonal cut creating the runic/angular style
func RunicR() string {
	// This R design mimics the SVG path with the distinctive diagonal cut
	r := `
    ██████╗    
    ██╔══██╗   
    ██████╔╝   
    ██╔══██╗   
    ██║  ╚██╗  
    ╚═╝   ╚═╝  `

	return lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true).
		Render(r)
}

// LogoLarge returns the full RUNE logo without borders - clean and modern
func LogoLarge() string {
	// Runic-styled RUNE logo with the distinctive R
	logo := `
    ██████╗  ██╗   ██╗ ███╗   ██╗ ███████╗
    ██╔══██╗ ██║   ██║ ████╗  ██║ ██╔════╝
    ██████╔╝ ██║   ██║ ██╔██╗ ██║ █████╗  
    ██╔══██╗ ██║   ██║ ██║╚██╗██║ ██╔══╝  
    ██║  ╚██╗╚██████╔╝ ██║ ╚████║ ███████╗
    ╚═╝   ╚═╝ ╚═════╝  ╚═╝  ╚═══╝ ╚══════╝`

	return lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true).
		Render(logo)
}

// LogoRunic returns the stylized runic logo inspired by the SVG
// This version emphasizes the angular, runic aesthetic
func LogoRunic() string {
	// Runic-style logo with angular design
	logo := `
    ╱██████╲  ╭╮   ╭╮  ╭╮   ╭╮  ████████
    ║██╔══██║ ║║   ║║  ║╲╮  ║║  ██╔═════
    ║██████╔╝ ║║   ║║  ║ ╲╮ ║║  █████╗  
    ║██╔═══╝  ║║   ║║  ║  ╲╮║║  ██╔══╝  
    ║██║  ╲╮  ╰████╯║  ║   ╲╮║  ████████
    ╰╯╯   ╰╯   ╰═══╯   ╰╯   ╰╯  ╰═══════`

	return lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true).
		Render(logo)
}

// LogoCompact returns a compact runic R icon (matches logo-compact.svg)
func LogoCompact() string {
	// Compact runic R matching the SVG polygon design
	// The SVG shows an angular R with a distinctive diagonal cut
	r := `
      ██████╗ 
      ██╔══██╗
      ██████╔╝
      ██╔═══╝ 
      ██║ ╲   
      ╚═╝  ╲  `

	return lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true).
		Render(r)
}

// LogoStone returns the runic stone-styled logo (matches rune-stone.svg)
func LogoStone() string {
	stone := `
          ╱╲
         ╱  ╲
        ╱ ██ ╲
       ╱ ████ ╲
      ╱  ╔══╗  ╲
     ╱   ║██║   ╲
    ╱    ║██║    ╲
   ╱     ╚══╝     ╲
  ╱   R  U  N  E   ╲
 ╱─────────────────╲
╱___________________╲`

	return lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Render(stone)
}

// LogoSmall returns a compact version of the logo
func LogoSmall() string {
	logo := `
  ██████╗  ╦ ╦ ╦╗╔ ████
  ██╔══██╗ ║ ║ ║╚╗ ██
  ██████╔╝ ║ ║ ║ ║ ████
  ██╔═══╝  ║ ║ ║ ║ ██
  ██║ ╲    ╚═╝ ╝ ╝ ████`

	return lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Render(logo)
}

// LogoMinimal returns a single-line logo
func LogoMinimal() string {
	runeStyle := lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true)

	cliStyle := lipgloss.NewStyle().
		Foreground(MutedColor)

	return runeStyle.Render("◆ RUNE") + cliStyle.Render(" CLI")
}

// LogoIcon returns a small runic icon
func LogoIcon() string {
	return lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true).
		Render("◆")
}

// WelcomeBanner returns the full welcome screen with logo - no borders, clean design
func WelcomeBanner() string {
	var b strings.Builder

	// Logo with gradient effect simulation using different shades
	logoLines := []string{
		"",
		"      ██████╗  ██╗   ██╗ ███╗   ██╗ ███████╗",
		"      ██╔══██╗ ██║   ██║ ████╗  ██║ ██╔════╝",
		"      ██████╔╝ ██║   ██║ ██╔██╗ ██║ █████╗  ",
		"      ██╔══██╗ ██║   ██║ ██║╚██╗██║ ██╔══╝  ",
		"      ██║  ╚██╗╚██████╔╝ ██║ ╚████║ ███████╗",
		"      ╚═╝   ╚═╝ ╚═════╝  ╚═╝  ╚═══╝ ╚══════╝",
		"",
	}

	// Render logo with primary color
	logoStyle := lipgloss.NewStyle().Foreground(PrimaryColor).Bold(true)
	for _, line := range logoLines {
		b.WriteString(logoStyle.Render(line) + "\n")
	}

	// Tagline centered
	tagline := "        Workflow Automation Platform"
	taglineStyle := lipgloss.NewStyle().Foreground(SecondaryColor).Italic(true)
	b.WriteString(taglineStyle.Render(tagline) + "\n")

	// Version with subtle styling
	versionLine := fmt.Sprintf("                    v%s", Version)
	versionStyle := lipgloss.NewStyle().Foreground(MutedColor)
	b.WriteString(versionStyle.Render(versionLine) + "\n")

	return b.String()
}

// WelcomeMessage returns the welcome message shown after the banner
func WelcomeMessage() string {
	var b strings.Builder

	successIcon := lipgloss.NewStyle().Foreground(SuccessColor).Render("✓")
	arrowIcon := lipgloss.NewStyle().Foreground(AccentColor).Render("›")
	dimStyle := lipgloss.NewStyle().Foreground(DimColor)
	cmdStyle := lipgloss.NewStyle().Foreground(SecondaryColor).Bold(true)
	headerStyle := lipgloss.NewStyle().Foreground(PrimaryColor).Bold(true)

	b.WriteString("\n")
	b.WriteString(fmt.Sprintf("%s Welcome to RUNE CLI!\n", successIcon))
	b.WriteString("\n")

	b.WriteString(headerStyle.Render("Quick Start") + "\n")
	b.WriteString(dimStyle.Render(strings.Repeat("─", 40)) + "\n")
	b.WriteString(fmt.Sprintf("  %s %s           %s\n", arrowIcon, cmdStyle.Render("rune"), dimStyle.Render("Launch interactive TUI")))
	b.WriteString(fmt.Sprintf("  %s %s      %s\n", arrowIcon, cmdStyle.Render("rune tui"), dimStyle.Render("Launch interactive TUI")))
	b.WriteString(fmt.Sprintf("  %s %s    %s\n", arrowIcon, cmdStyle.Render("rune login"), dimStyle.Render("Authenticate with the API")))
	b.WriteString(fmt.Sprintf("  %s %s     %s\n", arrowIcon, cmdStyle.Render("rune help"), dimStyle.Render("Show all commands")))
	b.WriteString("\n")

	b.WriteString(headerStyle.Render("Commands") + "\n")
	b.WriteString(dimStyle.Render(strings.Repeat("─", 40)) + "\n")
	b.WriteString(fmt.Sprintf("  %s  %s\n", cmdStyle.Render("workflows"), dimStyle.Render("Manage workflows")))
	b.WriteString(fmt.Sprintf("  %s      %s\n", cmdStyle.Render("users"), dimStyle.Render("User management")))
	b.WriteString(fmt.Sprintf("  %s     %s\n", cmdStyle.Render("config"), dimStyle.Render("Configuration settings")))
	b.WriteString(fmt.Sprintf("  %s  %s\n", cmdStyle.Render("db health"), dimStyle.Render("Check database connection")))
	b.WriteString("\n")

	footerStyle := lipgloss.NewStyle().Foreground(DimColor).Italic(true)
	b.WriteString(footerStyle.Render("Docs: https://docs.rune.io") + "\n")

	return b.String()
}

// ShortWelcome returns a compact welcome message for command mode
func ShortWelcome() string {
	icon := lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Render("◆")

	name := lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true).
		Render(" RUNE")

	version := lipgloss.NewStyle().
		Foreground(MutedColor).
		Render(fmt.Sprintf(" v%s", Version))

	return icon + name + version
}

// Divider returns a horizontal divider line
func Divider(width int) string {
	return lipgloss.NewStyle().
		Foreground(BorderColor).
		Render(strings.Repeat("─", width))
}

// DividerDouble returns a double-line divider
func DividerDouble(width int) string {
	return lipgloss.NewStyle().
		Foreground(BorderColor).
		Render(strings.Repeat("═", width))
}

// SectionHeader returns a formatted section header
func SectionHeader(title string) string {
	icon := lipgloss.NewStyle().Foreground(AccentColor).Render("◆")
	titleStyle := lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true)

	return fmt.Sprintf("\n%s %s\n", icon, titleStyle.Render(title))
}

// SectionHeaderSimple returns a simple section header
func SectionHeaderSimple(title string) string {
	return lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true).
		MarginTop(1).
		MarginBottom(1).
		Render("━━━ " + title + " ━━━")
}

// TUIHeader returns the header for TUI mode
func TUIHeader() string {
	logo := `╭──────────────────────────────────────────╮
│     ██████╗  ██╗   ██╗ ███╗   ██╗ ███████╗│
│     ██╔══██╗ ██║   ██║ ████╗  ██║ ██╔════╝│
│     ██████╔╝ ██║   ██║ ██╔██╗ ██║ █████╗  │
│     ██╔══██╗ ██║   ██║ ██║╚██╗██║ ██╔══╝  │
│     ██║  ╚██╗╚██████╔╝ ██║ ╚████║ ███████╗│
│     ╚═╝   ╚═╝ ╚═════╝  ╚═╝  ╚═══╝ ╚══════╝│
╰──────────────────────────────────────────╯`

	return lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Render(logo)
}

// TUIHeaderCompact returns a compact header for TUI
func TUIHeaderCompact() string {
	return lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true).
		Render("◆ RUNE") +
		lipgloss.NewStyle().
			Foreground(MutedColor).
			Render(" │ Workflow Automation")
}

// StatusBarContent returns formatted status bar content with left, center, right sections
func StatusBarContent(left, center, right string) string {
	leftStyle := lipgloss.NewStyle().Foreground(MutedColor)
	centerStyle := lipgloss.NewStyle().Foreground(SecondaryColor)
	rightStyle := lipgloss.NewStyle().Foreground(DimColor)

	return leftStyle.Render(left) + "  " +
		centerStyle.Render(center) + "  " +
		rightStyle.Render(right)
}
