/*
Package app provides the interactive TUI (Terminal User Interface) for RUNE CLI.

The TUI uses Bubble Tea framework with the Elm architecture pattern:
  - Model: Application state
  - Update: Handle messages and update state
  - View: Render the current state

Features:
  - Animated logo and loading states
  - Real-time data fetching from API
  - Keyboard navigation
  - Multiple screens (Dashboard, Users, Workflows, etc.)
*/
package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/rune-org/rune-cli/internal/api"
	"github.com/rune-org/rune-cli/internal/config"
	"github.com/rune-org/rune-cli/internal/models"
	"github.com/rune-org/rune-cli/internal/theme"
)

// Screen identifiers for navigation
type Screen int

const (
	ScreenDashboard Screen = iota
	ScreenUsers
	ScreenWorkflows
	ScreenCredentials
	ScreenExecutions
	ScreenTemplates
	ScreenSettings
	ScreenDatabase
	ScreenHelp
)

// Messages for async operations
type usersLoadedMsg struct{ users []models.User }
type workflowsLoadedMsg struct{ workflows []models.Workflow }
type executionsLoadedMsg struct{ executions []models.Execution }
type errorMsg struct{ err error }
type tickMsg time.Time

// Model is the main application state
type Model struct {
	// Window dimensions
	width  int
	height int

	// Navigation
	currentScreen  Screen
	sidebarFocused bool
	menuIndex      int

	// Status
	statusMessage string
	isLoading     bool
	isError       bool

	// Authentication
	isAuthenticated bool
	userEmail       string
	userRole        string

	// Configuration
	apiURL string

	// Data
	users      []models.User
	workflows  []models.Workflow
	executions []models.Execution

	// Selection state for lists
	selectedIndex int

	// Animation
	spinner     spinner.Model
	logoFrame   int
	showLogo    bool
	initialized bool
}

// Menu items for the sidebar
type menuItem struct {
	name   string
	screen Screen
	icon   string
}

var menuItems = []menuItem{
	{"Dashboard", ScreenDashboard, "◆"},
	{"Users", ScreenUsers, "●"},
	{"Workflows", ScreenWorkflows, "◉"},
	{"Credentials", ScreenCredentials, "◈"},
	{"Executions", ScreenExecutions, "▸"},
	{"Templates", ScreenTemplates, "◇"},
	{"Settings", ScreenSettings, "⚙"},
	{"Database", ScreenDatabase, "▤"},
	{"Help", ScreenHelp, "?"},
}

// Key bindings
type keyMap struct {
	Up      key.Binding
	Down    key.Binding
	Left    key.Binding
	Right   key.Binding
	Enter   key.Binding
	Tab     key.Binding
	Quit    key.Binding
	Help    key.Binding
	Refresh key.Binding
	Back    key.Binding
}

var keys = keyMap{
	Up: key.NewBinding(
		key.WithKeys("up", "k"),
		key.WithHelp("↑/k", "up"),
	),
	Down: key.NewBinding(
		key.WithKeys("down", "j"),
		key.WithHelp("↓/j", "down"),
	),
	Left: key.NewBinding(
		key.WithKeys("left", "h"),
		key.WithHelp("←/h", "left"),
	),
	Right: key.NewBinding(
		key.WithKeys("right", "l"),
		key.WithHelp("→/l", "right"),
	),
	Enter: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "select"),
	),
	Tab: key.NewBinding(
		key.WithKeys("tab"),
		key.WithHelp("tab", "switch panel"),
	),
	Quit: key.NewBinding(
		key.WithKeys("q", "ctrl+c"),
		key.WithHelp("q", "quit"),
	),
	Help: key.NewBinding(
		key.WithKeys("?"),
		key.WithHelp("?", "help"),
	),
	Refresh: key.NewBinding(
		key.WithKeys("r"),
		key.WithHelp("r", "refresh"),
	),
	Back: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "back"),
	),
}

// NewModel creates a new application model
func NewModel() Model {
	cfg := config.Get()
	creds, _ := config.LoadCredentials()

	// Initialize spinner
	s := spinner.New()
	s.Spinner = spinner.Spinner{
		Frames: []string{"◇ ", "◈ ", "◆ ", "◈ "},
		FPS:    time.Second / 4,
	}
	s.Style = lipgloss.NewStyle().Foreground(theme.PrimaryColor)

	m := Model{
		currentScreen:  ScreenDashboard,
		sidebarFocused: true,
		menuIndex:      0,
		apiURL:         cfg.APIURL,
		spinner:        s,
		showLogo:       true,
		logoFrame:      0,
	}

	if creds != nil && creds.AccessToken != "" {
		m.isAuthenticated = true
		m.userEmail = creds.Email
		m.userRole = creds.Role
	}

	return m
}

// Init initializes the model
func (m Model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		tickCmd(),
	)
}

func tickCmd() tea.Cmd {
	return tea.Tick(time.Millisecond*150, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

// Commands to load data
func loadUsers() tea.Cmd {
	return func() tea.Msg {
		client := api.NewClientFromConfig()
		users, err := client.ListUsers()
		if err != nil {
			return errorMsg{err}
		}
		return usersLoadedMsg{users}
	}
}

func loadWorkflows() tea.Cmd {
	return func() tea.Msg {
		client := api.NewClientFromConfig()
		workflows, err := client.ListWorkflows()
		if err != nil {
			return errorMsg{err}
		}
		return workflowsLoadedMsg{workflows}
	}
}

func loadExecutions() tea.Cmd {
	return func() tea.Msg {
		client := api.NewClientFromConfig()
		executions, err := client.ListExecutions()
		if err != nil {
			return errorMsg{err}
		}
		return executionsLoadedMsg{executions}
	}
}

// Update handles messages and updates the model
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		if !m.initialized {
			m.initialized = true
			// Load initial data if authenticated
			if m.isAuthenticated {
				cmds = append(cmds, loadUsers(), loadWorkflows(), loadExecutions())
				m.isLoading = true
			}
		}

	case tickMsg:
		// Animate logo
		m.logoFrame = (m.logoFrame + 1) % 10
		if m.logoFrame > 6 {
			m.showLogo = false
		}
		cmds = append(cmds, tickCmd())

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		cmds = append(cmds, cmd)

	case usersLoadedMsg:
		m.users = msg.users
		m.isLoading = false
		m.statusMessage = fmt.Sprintf("Loaded %d users", len(msg.users))
		m.isError = false

	case workflowsLoadedMsg:
		m.workflows = msg.workflows
		m.statusMessage = fmt.Sprintf("Loaded %d workflows", len(msg.workflows))
		m.isError = false

	case executionsLoadedMsg:
		m.executions = msg.executions
		m.isError = false

	case errorMsg:
		m.isLoading = false
		m.statusMessage = msg.err.Error()
		m.isError = true

	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keys.Quit):
			return m, tea.Quit

		case key.Matches(msg, keys.Up):
			if m.sidebarFocused && m.menuIndex > 0 {
				m.menuIndex--
				m.currentScreen = menuItems[m.menuIndex].screen
				m.selectedIndex = 0
			} else if !m.sidebarFocused && m.selectedIndex > 0 {
				m.selectedIndex--
			}

		case key.Matches(msg, keys.Down):
			if m.sidebarFocused && m.menuIndex < len(menuItems)-1 {
				m.menuIndex++
				m.currentScreen = menuItems[m.menuIndex].screen
				m.selectedIndex = 0
			} else if !m.sidebarFocused {
				maxIndex := m.getMaxIndex()
				if m.selectedIndex < maxIndex-1 {
					m.selectedIndex++
				}
			}

		case key.Matches(msg, keys.Tab):
			m.sidebarFocused = !m.sidebarFocused

		case key.Matches(msg, keys.Help):
			m.currentScreen = ScreenHelp
			m.menuIndex = 8 // Help index

		case key.Matches(msg, keys.Refresh):
			if m.isAuthenticated {
				m.isLoading = true
				m.statusMessage = "Refreshing..."
				switch m.currentScreen {
				case ScreenUsers:
					cmds = append(cmds, loadUsers())
				case ScreenWorkflows:
					cmds = append(cmds, loadWorkflows())
				case ScreenExecutions:
					cmds = append(cmds, loadExecutions())
				default:
					cmds = append(cmds, loadUsers(), loadWorkflows(), loadExecutions())
				}
			}

		case key.Matches(msg, keys.Enter):
			if m.sidebarFocused {
				m.sidebarFocused = false
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m Model) getMaxIndex() int {
	switch m.currentScreen {
	case ScreenUsers:
		return len(m.users)
	case ScreenWorkflows:
		return len(m.workflows)
	case ScreenExecutions:
		return len(m.executions)
	default:
		return 0
	}
}

// View renders the current state
func (m Model) View() string {
	if m.width == 0 || m.height == 0 {
		return "Loading..."
	}

	// Layout dimensions
	sidebarWidth := 22
	contentWidth := m.width - sidebarWidth - 3
	contentHeight := m.height - 6 // Header + status bar + padding

	// Build layout
	header := m.renderHeader()
	sidebar := m.renderSidebar(sidebarWidth, contentHeight)
	content := m.renderContent(contentWidth, contentHeight)
	statusBar := m.renderStatusBar()

	// Combine sidebar and content
	mainArea := lipgloss.JoinHorizontal(lipgloss.Top, sidebar, content)

	// Stack vertically
	return lipgloss.JoinVertical(lipgloss.Left, header, mainArea, statusBar)
}

func (m Model) renderHeader() string {
	// Animated RUNE logo in header
	logoStyle := lipgloss.NewStyle().
		Foreground(theme.PrimaryColor).
		Bold(true)

	var logo string
	if m.showLogo {
		frames := []string{"R", "RU", "RUN", "RUNE", "RUNE", "RUNE"}
		frameIdx := m.logoFrame
		if frameIdx >= len(frames) {
			frameIdx = len(frames) - 1
		}
		logo = "◆ " + frames[frameIdx]
	} else {
		logo = "◆ RUNE"
	}

	titleStyle := lipgloss.NewStyle().
		Background(lipgloss.Color("#1E3A5F")).
		Foreground(lipgloss.Color("#F8FAFC")).
		Padding(0, 2).
		Width(m.width)

	title := logoStyle.Render(logo) + lipgloss.NewStyle().
		Background(lipgloss.Color("#1E3A5F")).
		Foreground(lipgloss.Color("#94A3B8")).
		Render(" CLI")

	if m.isAuthenticated {
		userInfo := lipgloss.NewStyle().
			Background(lipgloss.Color("#1E3A5F")).
			Foreground(lipgloss.Color("#94A3B8")).
			Render(" │ " + m.userEmail)
		if m.userRole == "admin" {
			userInfo += lipgloss.NewStyle().
				Background(lipgloss.Color("#1E3A5F")).
				Foreground(theme.WarningColor).
				Render(" (Admin)")
		}
		title += userInfo
	}

	if m.isLoading {
		title += lipgloss.NewStyle().
			Background(lipgloss.Color("#1E3A5F")).
			Render("  " + m.spinner.View())
	}

	return titleStyle.Render(title)
}

func (m Model) renderSidebar(width, height int) string {
	var items []string

	// Mini logo at top
	logoLine := lipgloss.NewStyle().
		Foreground(theme.PrimaryColor).
		Bold(true).
		Render("  ◆ RUNE")
	items = append(items, logoLine)
	items = append(items, lipgloss.NewStyle().Foreground(theme.BorderColor).Render("  "+strings.Repeat("─", width-6)))
	items = append(items, "")

	for i, item := range menuItems {
		style := lipgloss.NewStyle().
			Width(width-4).
			Padding(0, 1)

		label := fmt.Sprintf("%s %s", item.icon, item.name)

		if i == m.menuIndex {
			if m.sidebarFocused {
				style = style.
					Background(theme.PrimaryColor).
					Foreground(lipgloss.Color("#FFFFFF")).
					Bold(true)
			} else {
				style = style.
					Background(lipgloss.Color("#334155")).
					Foreground(lipgloss.Color("#F8FAFC"))
			}
		} else {
			style = style.Foreground(theme.MutedColor)
		}

		items = append(items, style.Render(label))
	}

	content := strings.Join(items, "\n")

	sidebarStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(theme.BorderColor).
		Width(width).
		Height(height).
		Padding(1, 1)

	return sidebarStyle.Render(content)
}

func (m Model) renderContent(width, height int) string {
	var content string

	switch m.currentScreen {
	case ScreenDashboard:
		content = m.renderDashboard(width, height)
	case ScreenUsers:
		content = m.renderUsersScreen(width, height)
	case ScreenWorkflows:
		content = m.renderWorkflowsScreen(width, height)
	case ScreenCredentials:
		content = m.renderCredentialsScreen(width, height)
	case ScreenExecutions:
		content = m.renderExecutionsScreen(width, height)
	case ScreenTemplates:
		content = m.renderTemplatesScreen(width, height)
	case ScreenSettings:
		content = m.renderSettingsScreen(width, height)
	case ScreenDatabase:
		content = m.renderDatabaseScreen(width, height)
	case ScreenHelp:
		content = m.renderHelpScreen(width, height)
	default:
		content = "Unknown screen"
	}

	contentStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(theme.BorderColor).
		Width(width).
		Height(height).
		Padding(1, 2)

	return contentStyle.Render(content)
}

func (m Model) renderStatusBar() string {
	statusStyle := lipgloss.NewStyle().
		Background(lipgloss.Color("#1E293B")).
		Foreground(lipgloss.Color("#94A3B8")).
		Width(m.width).
		Padding(0, 1)

	helpText := "↑↓ Navigate │ Tab Switch │ r Refresh │ ? Help │ q Quit"

	if m.statusMessage != "" {
		if m.isError {
			helpText = lipgloss.NewStyle().Foreground(theme.ErrorColor).Render("✗ "+m.statusMessage) + "  │  " + helpText
		} else {
			helpText = lipgloss.NewStyle().Foreground(theme.SuccessColor).Render("✓ "+m.statusMessage) + "  │  " + helpText
		}
	}

	return statusStyle.Render(helpText)
}

func (m Model) renderDashboard(width, height int) string {
	var b strings.Builder

	// Animated title
	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.PrimaryColor)
	b.WriteString(titleStyle.Render("◆ Dashboard") + "\n\n")

	// Stats cards
	cardStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(theme.BorderColor).
		Padding(0, 2).
		Width(20)

	// Workflow count
	wfCount := fmt.Sprintf("%d", len(m.workflows))
	wfCard := cardStyle.Render(
		lipgloss.NewStyle().Foreground(theme.SecondaryColor).Bold(true).Render(wfCount) + "\n" +
			lipgloss.NewStyle().Foreground(theme.MutedColor).Render("Workflows"))

	// User count
	userCount := fmt.Sprintf("%d", len(m.users))
	userCard := cardStyle.Render(
		lipgloss.NewStyle().Foreground(theme.SuccessColor).Bold(true).Render(userCount) + "\n" +
			lipgloss.NewStyle().Foreground(theme.MutedColor).Render("Users"))

	// Execution count
	exCount := fmt.Sprintf("%d", len(m.executions))
	exCard := cardStyle.Render(
		lipgloss.NewStyle().Foreground(theme.InfoColor).Bold(true).Render(exCount) + "\n" +
			lipgloss.NewStyle().Foreground(theme.MutedColor).Render("Executions"))

	b.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, wfCard, " ", userCard, " ", exCard))
	b.WriteString("\n\n")

	// System status
	b.WriteString(theme.Bold.Render("System Status") + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(theme.BorderColor).Render(strings.Repeat("─", 40)) + "\n")

	statusIcon := lipgloss.NewStyle().Foreground(theme.SuccessColor).Render("●")
	warningIcon := lipgloss.NewStyle().Foreground(theme.WarningColor).Render("●")

	if m.isAuthenticated {
		b.WriteString(fmt.Sprintf("%s API Server       Connected\n", statusIcon))
		b.WriteString(fmt.Sprintf("%s Authentication   Active\n", statusIcon))
	} else {
		b.WriteString(fmt.Sprintf("%s API Server       Not authenticated\n", warningIcon))
	}
	b.WriteString(fmt.Sprintf("%s Configuration    Loaded\n", statusIcon))

	b.WriteString("\n")
	b.WriteString(theme.Bold.Render("Quick Info") + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(theme.BorderColor).Render(strings.Repeat("─", 40)) + "\n")
	b.WriteString(fmt.Sprintf("API URL: %s\n", theme.MutedStyle.Render(m.apiURL)))

	if m.isAuthenticated {
		b.WriteString(fmt.Sprintf("User:    %s\n", m.userEmail))
		b.WriteString(fmt.Sprintf("Role:    %s\n", lipgloss.NewStyle().Foreground(theme.WarningColor).Render(strings.ToUpper(m.userRole))))
	}

	return b.String()
}

func (m Model) renderUsersScreen(width, height int) string {
	var b strings.Builder

	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.PrimaryColor)
	b.WriteString(titleStyle.Render("● Users") + "\n\n")

	if !m.isAuthenticated {
		b.WriteString(theme.WarningStyle.Render("Not authenticated") + "\n\n")
		b.WriteString(theme.MutedStyle.Render("Run 'rune auth login' to authenticate"))
		return b.String()
	}

	if m.isLoading {
		b.WriteString(m.spinner.View() + " Loading users...\n")
		return b.String()
	}

	if len(m.users) == 0 {
		b.WriteString(theme.MutedStyle.Render("No users found") + "\n")
		return b.String()
	}

	// Table header
	headerStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.SecondaryColor)
	b.WriteString(fmt.Sprintf("  %-4s %-25s %-8s %-8s\n",
		headerStyle.Render("ID"),
		headerStyle.Render("Email"),
		headerStyle.Render("Role"),
		headerStyle.Render("Status")))
	b.WriteString("  " + lipgloss.NewStyle().Foreground(theme.BorderColor).Render(strings.Repeat("─", 50)) + "\n")

	// Show users (limited by height)
	maxUsers := height - 10
	if maxUsers < 1 {
		maxUsers = 5
	}

	for i, u := range m.users {
		if i >= maxUsers {
			b.WriteString(fmt.Sprintf("\n  %s", theme.MutedStyle.Render(fmt.Sprintf("... and %d more", len(m.users)-maxUsers))))
			break
		}

		rowStyle := lipgloss.NewStyle()
		if i == m.selectedIndex && !m.sidebarFocused {
			rowStyle = rowStyle.Background(lipgloss.Color("#334155"))
		}

		status := lipgloss.NewStyle().Foreground(theme.SuccessColor).Render("active")
		if !u.IsActive {
			status = lipgloss.NewStyle().Foreground(theme.MutedColor).Render("inactive")
		}

		role := u.Role
		if role == "admin" {
			role = lipgloss.NewStyle().Foreground(theme.WarningColor).Render("ADMIN")
		}

		email := u.Email
		if len(email) > 23 {
			email = email[:20] + "..."
		}

		row := fmt.Sprintf("  %-4d %-25s %-8s %-8s", u.ID, email, role, status)
		b.WriteString(rowStyle.Render(row) + "\n")
	}

	return b.String()
}

func (m Model) renderWorkflowsScreen(width, height int) string {
	var b strings.Builder

	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.PrimaryColor)
	b.WriteString(titleStyle.Render("◉ Workflows") + "\n\n")

	if !m.isAuthenticated {
		b.WriteString(theme.WarningStyle.Render("Not authenticated") + "\n\n")
		b.WriteString(theme.MutedStyle.Render("Run 'rune auth login' to authenticate"))
		return b.String()
	}

	if m.isLoading {
		b.WriteString(m.spinner.View() + " Loading workflows...\n")
		return b.String()
	}

	if len(m.workflows) == 0 {
		b.WriteString(theme.MutedStyle.Render("No workflows found") + "\n\n")
		b.WriteString("Create your first workflow in the web editor\n")
		return b.String()
	}

	// Table header
	headerStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.SecondaryColor)
	b.WriteString(fmt.Sprintf("  %-4s %-30s %-10s\n",
		headerStyle.Render("ID"),
		headerStyle.Render("Name"),
		headerStyle.Render("Status")))
	b.WriteString("  " + lipgloss.NewStyle().Foreground(theme.BorderColor).Render(strings.Repeat("─", 50)) + "\n")

	maxItems := height - 10
	if maxItems < 1 {
		maxItems = 5
	}

	for i, wf := range m.workflows {
		if i >= maxItems {
			b.WriteString(fmt.Sprintf("\n  %s", theme.MutedStyle.Render(fmt.Sprintf("... and %d more", len(m.workflows)-maxItems))))
			break
		}

		rowStyle := lipgloss.NewStyle()
		if i == m.selectedIndex && !m.sidebarFocused {
			rowStyle = rowStyle.Background(lipgloss.Color("#334155"))
		}

		status := lipgloss.NewStyle().Foreground(theme.MutedColor).Render("draft")
		if wf.IsPublished {
			status = lipgloss.NewStyle().Foreground(theme.SuccessColor).Render("published")
		}

		name := wf.Name
		if len(name) > 28 {
			name = name[:25] + "..."
		}

		row := fmt.Sprintf("  %-4d %-30s %-10s", wf.ID, name, status)
		b.WriteString(rowStyle.Render(row) + "\n")
	}

	return b.String()
}

func (m Model) renderCredentialsScreen(width, height int) string {
	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.PrimaryColor)
	return titleStyle.Render("◈ Credentials") + "\n\n" +
		theme.MutedStyle.Render("Credential management") + "\n\n" +
		"Manage your API keys and secrets.\n\n" +
		"CLI commands:\n" +
		"  rune credentials list\n" +
		"  rune credentials add\n"
}

func (m Model) renderExecutionsScreen(width, height int) string {
	var b strings.Builder

	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.PrimaryColor)
	b.WriteString(titleStyle.Render("▸ Executions") + "\n\n")

	if !m.isAuthenticated {
		b.WriteString(theme.WarningStyle.Render("Not authenticated") + "\n")
		return b.String()
	}

	if m.isLoading {
		b.WriteString(m.spinner.View() + " Loading executions...\n")
		return b.String()
	}

	if len(m.executions) == 0 {
		b.WriteString(theme.MutedStyle.Render("No recent executions") + "\n")
		return b.String()
	}

	headerStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.SecondaryColor)
	b.WriteString(fmt.Sprintf("  %-12s %-8s %-10s %-10s\n",
		headerStyle.Render("ID"),
		headerStyle.Render("Workflow"),
		headerStyle.Render("Status"),
		headerStyle.Render("Trigger")))
	b.WriteString("  " + lipgloss.NewStyle().Foreground(theme.BorderColor).Render(strings.Repeat("─", 50)) + "\n")

	maxItems := height - 10
	if maxItems < 1 {
		maxItems = 5
	}

	for i, ex := range m.executions {
		if i >= maxItems {
			break
		}

		statusStyle := theme.MutedStyle
		switch strings.ToLower(ex.Status) {
		case "completed", "success":
			statusStyle = theme.SuccessStyle
		case "running", "pending":
			statusStyle = theme.InfoStyle
		case "failed", "error":
			statusStyle = theme.ErrorStyle
		}

		id := ex.ID
		if len(id) > 10 {
			id = id[:10] + ".."
		}

		row := fmt.Sprintf("  %-12s %-8d %-10s %-10s",
			id,
			ex.WorkflowID,
			statusStyle.Render(ex.Status),
			ex.TriggerType)
		b.WriteString(row + "\n")
	}

	return b.String()
}

func (m Model) renderTemplatesScreen(width, height int) string {
	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.PrimaryColor)
	return titleStyle.Render("◇ Templates") + "\n\n" +
		theme.MutedStyle.Render("Browse workflow templates") + "\n\n" +
		"Coming soon..."
}

func (m Model) renderSettingsScreen(width, height int) string {
	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.PrimaryColor)

	var b strings.Builder
	b.WriteString(titleStyle.Render("⚙ Settings") + "\n\n")

	cfg := config.Get()

	b.WriteString(theme.Bold.Render("Configuration") + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(theme.BorderColor).Render(strings.Repeat("─", 40)) + "\n")

	labelStyle := lipgloss.NewStyle().Foreground(theme.MutedColor).Width(14)

	b.WriteString(fmt.Sprintf("%s %s\n", labelStyle.Render("API URL:"), cfg.APIURL))
	b.WriteString(fmt.Sprintf("%s %d seconds\n", labelStyle.Render("Timeout:"), cfg.Timeout))
	b.WriteString(fmt.Sprintf("%s %v\n", labelStyle.Render("Colors:"), cfg.ColorEnabled))
	b.WriteString(fmt.Sprintf("%s %s\n", labelStyle.Render("Output:"), cfg.OutputFormat))

	b.WriteString("\n")
	b.WriteString(theme.Bold.Render("Paths") + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(theme.BorderColor).Render(strings.Repeat("─", 40)) + "\n")
	b.WriteString(fmt.Sprintf("%s %s\n", labelStyle.Render("Config:"), theme.MutedStyle.Render(config.GetConfigPath())))
	b.WriteString(fmt.Sprintf("%s %s\n", labelStyle.Render("Credentials:"), theme.MutedStyle.Render(config.GetCredentialsPath())))

	return b.String()
}

func (m Model) renderDatabaseScreen(width, height int) string {
	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.PrimaryColor)

	cfg := config.Get()
	var b strings.Builder

	b.WriteString(titleStyle.Render("▤ Database") + "\n\n")

	if cfg.DatabaseURL == "" {
		b.WriteString(theme.WarningStyle.Render("⚠ Database URL not configured") + "\n\n")
		b.WriteString("Configure with:\n")
		b.WriteString(theme.MutedStyle.Render("  rune config set-db <connection-string>") + "\n")
	} else {
		b.WriteString(theme.SuccessStyle.Render("● Direct database access available") + "\n\n")
		b.WriteString("CLI commands:\n")
		b.WriteString("  rune db health   - Check connection\n")
		b.WriteString("  rune db tables   - List tables\n")
		b.WriteString("  rune db reset    - Reset database\n")
	}

	return b.String()
}

func (m Model) renderHelpScreen(width, height int) string {
	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(theme.PrimaryColor)

	var b strings.Builder
	b.WriteString(titleStyle.Render("? Help") + "\n\n")

	b.WriteString(theme.Bold.Render("Navigation") + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(theme.BorderColor).Render(strings.Repeat("─", 30)) + "\n")

	keyStyle := lipgloss.NewStyle().Foreground(theme.SecondaryColor).Width(10)
	b.WriteString(fmt.Sprintf("%s Move up\n", keyStyle.Render("↑/k")))
	b.WriteString(fmt.Sprintf("%s Move down\n", keyStyle.Render("↓/j")))
	b.WriteString(fmt.Sprintf("%s Switch panel\n", keyStyle.Render("Tab")))
	b.WriteString(fmt.Sprintf("%s Select item\n", keyStyle.Render("Enter")))
	b.WriteString(fmt.Sprintf("%s Go back\n", keyStyle.Render("Esc")))
	b.WriteString(fmt.Sprintf("%s Quit\n", keyStyle.Render("q")))

	b.WriteString("\n")
	b.WriteString(theme.Bold.Render("Actions") + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(theme.BorderColor).Render(strings.Repeat("─", 30)) + "\n")
	b.WriteString(fmt.Sprintf("%s Refresh data\n", keyStyle.Render("r")))
	b.WriteString(fmt.Sprintf("%s Show help\n", keyStyle.Render("?")))

	b.WriteString("\n")
	b.WriteString(theme.MutedStyle.Render("For full CLI documentation:\n  rune --help"))

	return b.String()
}

// Run starts the TUI application
func Run() error {
	p := tea.NewProgram(NewModel(), tea.WithAltScreen())
	_, err := p.Run()
	return err
}
