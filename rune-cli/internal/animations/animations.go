/*
Package animations provides animated UI components for the RUNE CLI.

This package includes spinners, progress bars, loading indicators,
and transition effects that enhance the user experience.
*/
package animations

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/lipgloss"

	"github.com/rune-org/rune-cli/internal/theme"
)

// Use centralized theme colors instead of local duplicates
var (
	primaryColor   = theme.PrimaryColor
	secondaryColor = theme.SecondaryColor
	accentColor    = theme.AccentColor
	successColor   = theme.SuccessColor
	warningColor   = theme.WarningColor
	errorColor     = theme.ErrorColor
	mutedColor     = theme.MutedColor
)

// SpinnerType defines different spinner styles
type SpinnerType int

const (
	SpinnerDots SpinnerType = iota
	SpinnerLine
	SpinnerPulse
	SpinnerRune
	SpinnerGlobe
	SpinnerMeter
	SpinnerMini
)

// RuneSpinnerFrames are custom spinner frames with RUNE branding
var RuneSpinnerFrames = []string{
	"◇ ",
	"◈ ",
	"◆ ",
	"◈ ",
}

// PulseSpinnerFrames for a pulsing effect
var PulseSpinnerFrames = []string{
	"●    ",
	"●●   ",
	"●●●  ",
	"●●●● ",
	"●●●●●",
	" ●●●●",
	"  ●●●",
	"   ●●",
	"    ●",
	"     ",
}

// LoadingDotsFrames for a dots animation
var LoadingDotsFrames = []string{
	"⠋",
	"⠙",
	"⠹",
	"⠸",
	"⠼",
	"⠴",
	"⠦",
	"⠧",
	"⠇",
	"⠏",
}

// BlockSpinnerFrames for a block-style spinner
var BlockSpinnerFrames = []string{
	"█▒▒▒▒▒▒▒",
	"██▒▒▒▒▒▒",
	"███▒▒▒▒▒",
	"████▒▒▒▒",
	"█████▒▒▒",
	"██████▒▒",
	"███████▒",
	"████████",
	"▒███████",
	"▒▒██████",
	"▒▒▒█████",
	"▒▒▒▒████",
	"▒▒▒▒▒███",
	"▒▒▒▒▒▒██",
	"▒▒▒▒▒▒▒█",
	"▒▒▒▒▒▒▒▒",
}

// NewRuneSpinner creates a custom RUNE-branded spinner
func NewRuneSpinner() spinner.Model {
	s := spinner.New()
	s.Spinner = spinner.Spinner{
		Frames: RuneSpinnerFrames,
		FPS:    time.Second / 4,
	}
	s.Style = lipgloss.NewStyle().Foreground(primaryColor)
	return s
}

// NewPulseSpinner creates a pulsing spinner
func NewPulseSpinner() spinner.Model {
	s := spinner.New()
	s.Spinner = spinner.Spinner{
		Frames: PulseSpinnerFrames,
		FPS:    time.Second / 10,
	}
	s.Style = lipgloss.NewStyle().Foreground(accentColor)
	return s
}

// NewDotsSpinner creates a dots spinner
func NewDotsSpinner() spinner.Model {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(primaryColor)
	return s
}

// NewLineSpinner creates a line spinner
func NewLineSpinner() spinner.Model {
	s := spinner.New()
	s.Spinner = spinner.Line
	s.Style = lipgloss.NewStyle().Foreground(primaryColor)
	return s
}

// NewGlobeSpinner creates a globe spinner
func NewGlobeSpinner() spinner.Model {
	s := spinner.New()
	s.Spinner = spinner.Globe
	s.Style = lipgloss.NewStyle().Foreground(secondaryColor)
	return s
}

// NewMeterSpinner creates a meter-style spinner
func NewMeterSpinner() spinner.Model {
	s := spinner.New()
	s.Spinner = spinner.Meter
	s.Style = lipgloss.NewStyle().Foreground(primaryColor)
	return s
}

// NewMiniSpinner creates a minimal spinner
func NewMiniSpinner() spinner.Model {
	s := spinner.New()
	s.Spinner = spinner.MiniDot
	s.Style = lipgloss.NewStyle().Foreground(mutedColor)
	return s
}

// NewSpinner creates a spinner of the specified type
func NewSpinner(t SpinnerType) spinner.Model {
	switch t {
	case SpinnerLine:
		return NewLineSpinner()
	case SpinnerPulse:
		return NewPulseSpinner()
	case SpinnerRune:
		return NewRuneSpinner()
	case SpinnerGlobe:
		return NewGlobeSpinner()
	case SpinnerMeter:
		return NewMeterSpinner()
	case SpinnerMini:
		return NewMiniSpinner()
	default:
		return NewDotsSpinner()
	}
}

// ProgressBar represents a progress bar
type ProgressBar struct {
	Total     int
	Current   int
	Width     int
	ShowPerc  bool
	FillChar  string
	EmptyChar string
}

// NewProgressBar creates a new progress bar
func NewProgressBar(total, width int) *ProgressBar {
	return &ProgressBar{
		Total:     total,
		Current:   0,
		Width:     width,
		ShowPerc:  true,
		FillChar:  "█",
		EmptyChar: "░",
	}
}

// Update updates the progress bar
func (p *ProgressBar) Update(current int) {
	p.Current = current
	if p.Current > p.Total {
		p.Current = p.Total
	}
}

// Render returns the rendered progress bar
func (p *ProgressBar) Render() string {
	if p.Total == 0 {
		return ""
	}

	percent := float64(p.Current) / float64(p.Total)
	filled := int(percent * float64(p.Width))
	empty := p.Width - filled

	bar := lipgloss.NewStyle().Foreground(primaryColor).Render(strings.Repeat(p.FillChar, filled)) +
		lipgloss.NewStyle().Foreground(mutedColor).Render(strings.Repeat(p.EmptyChar, empty))

	if p.ShowPerc {
		percStyle := lipgloss.NewStyle().Foreground(secondaryColor)
		return fmt.Sprintf("%s %s", bar, percStyle.Render(fmt.Sprintf("%3.0f%%", percent*100)))
	}

	return bar
}

// LoadingMessage returns a styled loading message with spinner
func LoadingMessage(spinner, message string) string {
	spinnerStyle := lipgloss.NewStyle().Foreground(primaryColor)
	msgStyle := lipgloss.NewStyle().Foreground(mutedColor)
	return spinnerStyle.Render(spinner) + " " + msgStyle.Render(message)
}

// SuccessMessage returns a styled success message
func SuccessMessage(message string) string {
	icon := lipgloss.NewStyle().Foreground(successColor).Render("✓")
	msg := lipgloss.NewStyle().Foreground(successColor).Render(message)
	return fmt.Sprintf("%s %s", icon, msg)
}

// ErrorMessage returns a styled error message
func ErrorMessage(message string) string {
	icon := lipgloss.NewStyle().Foreground(errorColor).Render("✗")
	msg := lipgloss.NewStyle().Foreground(errorColor).Render(message)
	return fmt.Sprintf("%s %s", icon, msg)
}

// WarningMessage returns a styled warning message
func WarningMessage(message string) string {
	icon := lipgloss.NewStyle().Foreground(warningColor).Render("!")
	msg := lipgloss.NewStyle().Foreground(warningColor).Render(message)
	return fmt.Sprintf("%s %s", icon, msg)
}

// InfoMessage returns a styled info message
func InfoMessage(message string) string {
	icon := lipgloss.NewStyle().Foreground(primaryColor).Render("ℹ")
	msg := lipgloss.NewStyle().Foreground(mutedColor).Render(message)
	return fmt.Sprintf("%s %s", icon, msg)
}

// FadeIn generates fade-in frames for text (simulated with Unicode blocks)
func FadeIn(text string, steps int) []string {
	frames := make([]string, steps)
	chars := []string{"░", "▒", "▓", "█"}

	for i := 0; i < steps; i++ {
		if i < len(chars) {
			// Show obscured text
			obscured := ""
			for _, c := range text {
				if c == ' ' || c == '\n' {
					obscured += string(c)
				} else {
					obscured += chars[i]
				}
			}
			frames[i] = obscured
		} else {
			frames[i] = text
		}
	}

	return frames
}

// TypewriterEffect returns frames for a typewriter effect
func TypewriterEffect(text string) []string {
	runes := []rune(text)
	frames := make([]string, len(runes)+1)

	for i := 0; i <= len(runes); i++ {
		frames[i] = string(runes[:i])
		if i < len(runes) {
			frames[i] += "▌" // Cursor
		}
	}

	return frames
}

// BlinkCursor returns a blinking cursor effect
func BlinkCursor(visible bool) string {
	if visible {
		return lipgloss.NewStyle().Foreground(primaryColor).Render("▌")
	}
	return " "
}

// Countdown returns countdown frames
func Countdown(from int) []string {
	frames := make([]string, from+1)
	for i := from; i >= 0; i-- {
		if i == 0 {
			frames[from-i] = lipgloss.NewStyle().Foreground(successColor).Bold(true).Render("GO!")
		} else {
			frames[from-i] = lipgloss.NewStyle().Foreground(primaryColor).Bold(true).Render(fmt.Sprintf("%d", i))
		}
	}
	return frames
}

// WaveEffect creates a wave animation for text
func WaveEffect(text string, frame int) string {
	runes := []rune(text)
	result := ""

	for i, r := range runes {
		offset := (frame + i) % 6
		var color lipgloss.Color
		switch offset {
		case 0, 5:
			color = mutedColor
		case 1, 4:
			color = secondaryColor
		case 2, 3:
			color = primaryColor
		}
		result += lipgloss.NewStyle().Foreground(color).Render(string(r))
	}

	return result
}

// GradientText applies a gradient effect to text
func GradientText(text string, colors []lipgloss.Color) string {
	if len(colors) == 0 {
		return text
	}

	runes := []rune(text)
	result := ""

	for i, r := range runes {
		colorIdx := (i * len(colors)) / len(runes)
		if colorIdx >= len(colors) {
			colorIdx = len(colors) - 1
		}
		result += lipgloss.NewStyle().Foreground(colors[colorIdx]).Render(string(r))
	}

	return result
}

// RuneGradient is the default RUNE gradient colors
var RuneGradient = []lipgloss.Color{
	lipgloss.Color("#6366F1"),
	lipgloss.Color("#7C3AED"),
	lipgloss.Color("#8B5CF6"),
	lipgloss.Color("#A855F7"),
	lipgloss.Color("#C084FC"),
}

// AnimatedLogo returns frames for an animated RUNE logo reveal
func AnimatedLogo() []string {
	logo := []string{
		"      ██████╗  ██╗   ██╗ ███╗   ██╗ ███████╗",
		"      ██╔══██╗ ██║   ██║ ████╗  ██║ ██╔════╝",
		"      ██████╔╝ ██║   ██║ ██╔██╗ ██║ █████╗  ",
		"      ██╔══██╗ ██║   ██║ ██║╚██╗██║ ██╔══╝  ",
		"      ██║  ╚██╗╚██████╔╝ ██║ ╚████║ ███████╗",
		"      ╚═╝   ╚═╝ ╚═════╝  ╚═╝  ╚═══╝ ╚══════╝",
	}

	frames := make([]string, len(logo)+1)

	// Build up logo line by line
	for i := 0; i <= len(logo); i++ {
		frame := "\n"
		for j := 0; j < i; j++ {
			frame += lipgloss.NewStyle().Foreground(primaryColor).Bold(true).Render(logo[j]) + "\n"
		}
		frames[i] = frame
	}

	return frames
}

// SpinnerWithMessage returns a simple inline spinner with message
func SpinnerWithMessage(frame int, message string) string {
	frames := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
	spinner := frames[frame%len(frames)]

	return lipgloss.NewStyle().Foreground(primaryColor).Render(spinner) + " " +
		lipgloss.NewStyle().Foreground(mutedColor).Render(message)
}
