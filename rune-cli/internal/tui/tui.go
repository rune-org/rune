/*
Package tui provides a modern TUI (Terminal User Interface) for RUNE.
Clean, minimal design focused on usability.
*/
package tui

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/atotto/clipboard"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/rune-org/rune-cli/internal/api"
	"github.com/rune-org/rune-cli/internal/config"
	"github.com/rune-org/rune-cli/internal/db"
	"github.com/rune-org/rune-cli/internal/models"
	"github.com/rune-org/rune-cli/internal/theme"
)

// Screen identifiers
type Screen int

const (
	ScreenSplash Screen = iota
	ScreenDashboard
	ScreenUsers
	ScreenWorkflows
	ScreenExecutions
	ScreenCredentials
	ScreenTemplates
	ScreenDatabase
	ScreenConfig
	ScreenHelp
)

// Database view mode
type DBViewMode int

const (
	DBViewTables DBViewMode = iota
	DBViewTableData
)

// Messages
type (
	tickMsg             time.Time
	splashDoneMsg       struct{}
	usersLoadedMsg      struct{ users []models.User }
	workflowsLoadedMsg  struct{ workflows []models.Workflow }
	executionsLoadedMsg struct{ executions []models.Execution }
	dbHealthMsg         struct {
		healthy bool
		message string
	}
	dbTablesMsg    struct{ tables []string }
	dbTableDataMsg struct {
		tableName string
		columns   []string
		rows      [][]string
		rowCount  int
	}
	dbDeleteMsg struct {
		tableName string
		success   bool
		message   string
	}
	errorMsg       struct{ err error }
	configSavedMsg struct{}
	copyMsg        struct{ text string }
)

// Colors
var (
	primary   = lipgloss.Color("#60A5FA") // Soft blue
	secondary = lipgloss.Color("#A78BFA") // Purple
	success   = lipgloss.Color("#34D399") // Green
	warning   = lipgloss.Color("#FBBF24") // Yellow
	danger    = lipgloss.Color("#F87171") // Red
	muted     = lipgloss.Color("#9CA3AF") // Gray
	dim       = lipgloss.Color("#6B7280") // Darker gray
	text      = lipgloss.Color("#F3F4F6") // Light text
	bg        = lipgloss.Color("#111827") // Dark bg
	bgLight   = lipgloss.Color("#1F2937") // Lighter bg
	border    = lipgloss.Color("#374151") // Border
	highlight = lipgloss.Color("#1E40AF") // Selection
)

// Model is the main application state
type Model struct {
	width, height  int
	ready          bool
	currentScreen  Screen
	previousScreen Screen
	sidebarFocused bool
	menuIndex      int
	sidebarScroll  int

	// Splash
	splashFrame int
	splashDone  bool

	// Auth
	isAuthenticated bool
	userEmail       string
	userRole        string

	// Config
	cfg            *config.Config
	configInputs   []textinput.Model
	configFocusIdx int

	// Data
	users      []models.User
	workflows  []models.Workflow
	executions []models.Execution

	// Database
	dbHealthy       bool
	dbMessage       string
	dbTables        []string
	dbViewMode      DBViewMode
	dbSelectedTable string
	dbTableColumns  []string
	dbTableRows     [][]string
	dbTableRowCount int

	// Selection
	selectedIndex int
	scrollOffset  int

	// UI
	spinner spinner.Model

	// Status
	statusMessage string
	isLoading     bool
	isError       bool

	// Confirm dialog
	showConfirm    bool
	confirmMessage string
	confirmAction  func() tea.Cmd
}

// Menu items - ALL visible to everyone
var menuItems = []struct {
	name   string
	screen Screen
	key    string
}{
	{"Dashboard", ScreenDashboard, "1"},
	{"Users", ScreenUsers, "2"},
	{"Workflows", ScreenWorkflows, "3"},
	{"Executions", ScreenExecutions, "4"},
	{"Credentials", ScreenCredentials, "5"},
	{"Templates", ScreenTemplates, "6"},
	{"Database", ScreenDatabase, "7"},
	{"Config", ScreenConfig, "8"},
	{"Help", ScreenHelp, "?"},
}

// NewModel creates a new TUI model
func NewModel() Model {
	cfg := config.Get()
	creds, _ := config.LoadCredentials()

	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(primary)

	m := Model{
		currentScreen:  ScreenSplash,
		sidebarFocused: true,
		cfg:            cfg,
		spinner:        s,
		dbMessage:      "Connecting...",
		dbViewMode:     DBViewTables,
	}

	m.initConfigInputs()

	if creds != nil && creds.AccessToken != "" {
		m.isAuthenticated = true
		m.userEmail = creds.Email
		m.userRole = creds.Role
	}

	return m
}

func (m *Model) initConfigInputs() {
	m.configInputs = make([]textinput.Model, 4)

	m.configInputs[0] = textinput.New()
	m.configInputs[0].Placeholder = "http://localhost:8000"
	m.configInputs[0].SetValue(m.cfg.APIURL)
	m.configInputs[0].CharLimit = 256
	m.configInputs[0].Width = 50

	m.configInputs[1] = textinput.New()
	m.configInputs[1].Placeholder = "30"
	m.configInputs[1].SetValue(fmt.Sprintf("%d", m.cfg.Timeout))
	m.configInputs[1].CharLimit = 5
	m.configInputs[1].Width = 10

	m.configInputs[2] = textinput.New()
	m.configInputs[2].Placeholder = "postgres://user:pass@localhost:5432/db"
	m.configInputs[2].SetValue(m.cfg.DatabaseURL)
	m.configInputs[2].CharLimit = 512
	m.configInputs[2].Width = 55

	m.configInputs[3] = textinput.New()
	m.configInputs[3].Placeholder = "rune-postgres"
	m.configInputs[3].SetValue(m.cfg.DockerContainer)
	m.configInputs[3].CharLimit = 64
	m.configInputs[3].Width = 30
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		tickCmd(),
		splashDelayCmd(),
		checkDBHealth(m.cfg),
		loadDBTables(m.cfg),
	)
}

func tickCmd() tea.Cmd {
	return tea.Tick(time.Millisecond*60, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func splashDelayCmd() tea.Cmd {
	return tea.Tick(time.Millisecond*2200, func(t time.Time) tea.Msg {
		return splashDoneMsg{}
	})
}

// Commands
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

func checkDBHealth(cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		if cfg.DatabaseURL == "" {
			return dbHealthMsg{healthy: false, message: "Not configured"}
		}

		pool, err := db.Connect(cfg.DatabaseURL)
		if err != nil {
			return dbHealthMsg{healthy: false, message: "Failed: " + truncate(err.Error(), 30)}
		}
		defer pool.Close()

		health, err := db.CheckHealth(pool)
		if err != nil {
			return dbHealthMsg{healthy: false, message: "Error: " + truncate(err.Error(), 30)}
		}

		return dbHealthMsg{healthy: true, message: "Connected to " + health.DatabaseName}
	}
}

func loadDBTables(cfg *config.Config) tea.Cmd {
	return func() tea.Msg {
		if cfg.DatabaseURL == "" {
			return dbTablesMsg{tables: nil}
		}

		pool, err := db.Connect(cfg.DatabaseURL)
		if err != nil {
			return dbTablesMsg{tables: nil}
		}
		defer pool.Close()

		tableInfos, err := db.ListTables(pool)
		if err != nil {
			return dbTablesMsg{tables: nil}
		}

		tables := make([]string, len(tableInfos))
		for i, t := range tableInfos {
			tables[i] = t.Name
		}

		return dbTablesMsg{tables: tables}
	}
}

func loadTableData(cfg *config.Config, tableName string) tea.Cmd {
	return func() tea.Msg {
		if cfg.DatabaseURL == "" {
			return errorMsg{fmt.Errorf("database not configured")}
		}

		pool, err := db.Connect(cfg.DatabaseURL)
		if err != nil {
			return errorMsg{err}
		}
		defer pool.Close()

		ctx := context.Background()
		query := fmt.Sprintf("SELECT * FROM %s LIMIT 100", tableName)
		rows, err := pool.Query(ctx, query)
		if err != nil {
			return errorMsg{err}
		}
		defer rows.Close()

		fieldDescs := rows.FieldDescriptions()
		columns := make([]string, len(fieldDescs))
		for i, fd := range fieldDescs {
			columns[i] = string(fd.Name)
		}

		var dataRows [][]string
		for rows.Next() {
			values, err := rows.Values()
			if err != nil {
				continue
			}
			row := make([]string, len(values))
			for i, v := range values {
				row[i] = fmt.Sprintf("%v", v)
			}
			dataRows = append(dataRows, row)
		}

		var totalCount int
		countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)
		pool.QueryRow(ctx, countQuery).Scan(&totalCount)

		return dbTableDataMsg{
			tableName: tableName,
			columns:   columns,
			rows:      dataRows,
			rowCount:  totalCount,
		}
	}
}

func deleteTableData(cfg *config.Config, tableName string) tea.Cmd {
	return func() tea.Msg {
		if cfg.DatabaseURL == "" {
			return dbDeleteMsg{tableName: tableName, success: false, message: "Not configured"}
		}

		pool, err := db.Connect(cfg.DatabaseURL)
		if err != nil {
			return dbDeleteMsg{tableName: tableName, success: false, message: err.Error()}
		}
		defer pool.Close()

		ctx := context.Background()
		query := fmt.Sprintf("DELETE FROM %s", tableName)
		_, err = pool.Exec(ctx, query)
		if err != nil {
			return dbDeleteMsg{tableName: tableName, success: false, message: err.Error()}
		}

		return dbDeleteMsg{tableName: tableName, success: true, message: "Deleted all from " + tableName}
	}
}

// Update handles messages
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true

	case tea.MouseMsg:
		if msg.Action == tea.MouseActionPress && msg.Button == tea.MouseButtonLeft {
			m.handleMouseClick(msg.X, msg.Y)
		}

	case tickMsg:
		if !m.splashDone && m.splashFrame < 40 {
			m.splashFrame++
		}
		cmds = append(cmds, tickCmd())

	case splashDoneMsg:
		m.splashDone = true
		m.currentScreen = ScreenDashboard
		if m.isAuthenticated {
			cmds = append(cmds, loadUsers(), loadWorkflows(), loadExecutions())
			m.isLoading = true
		}

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

	case dbHealthMsg:
		m.dbHealthy = msg.healthy
		m.dbMessage = msg.message
		m.isError = !msg.healthy

	case dbTablesMsg:
		m.dbTables = msg.tables

	case dbTableDataMsg:
		m.dbSelectedTable = msg.tableName
		m.dbTableColumns = msg.columns
		m.dbTableRows = msg.rows
		m.dbTableRowCount = msg.rowCount
		m.dbViewMode = DBViewTableData
		m.selectedIndex = 0
		m.scrollOffset = 0
		m.isLoading = false
		m.statusMessage = fmt.Sprintf("Loaded %d rows", len(msg.rows))

	case dbDeleteMsg:
		m.showConfirm = false
		if msg.success {
			m.statusMessage = msg.message
			m.isError = false
			cmds = append(cmds, loadTableData(m.cfg, msg.tableName))
		} else {
			m.statusMessage = "Error: " + msg.message
			m.isError = true
		}

	case errorMsg:
		m.isLoading = false
		m.statusMessage = msg.err.Error()
		m.isError = true

	case configSavedMsg:
		m.statusMessage = "Config saved"
		m.isError = false
		cmds = append(cmds, checkDBHealth(m.cfg), loadDBTables(m.cfg))

	case copyMsg:
		m.statusMessage = "Copied: " + truncate(msg.text, 20)
		m.isError = false

	case tea.KeyMsg:
		if m.showConfirm {
			switch msg.String() {
			case "y", "Y":
				if m.confirmAction != nil {
					cmds = append(cmds, m.confirmAction())
				}
			case "n", "N", "esc":
				m.showConfirm = false
			}
			return m, tea.Batch(cmds...)
		}

		if m.currentScreen == ScreenSplash && !m.splashDone {
			m.splashDone = true
			m.currentScreen = ScreenDashboard
			if m.isAuthenticated {
				cmds = append(cmds, loadUsers(), loadWorkflows(), loadExecutions())
				m.isLoading = true
			}
			return m, tea.Batch(cmds...)
		}

		if m.currentScreen == ScreenConfig && !m.sidebarFocused {
			return m.handleConfigInput(msg)
		}

		switch msg.String() {
		case "q", "ctrl+c":
			return m, tea.Quit

		case "?":
			if m.currentScreen != ScreenHelp {
				m.previousScreen = m.currentScreen
				m.currentScreen = ScreenHelp
				m.menuIndex = 8
			}

		case "esc":
			if m.currentScreen == ScreenHelp {
				m.currentScreen = m.previousScreen
				for i, item := range menuItems {
					if item.screen == m.currentScreen {
						m.menuIndex = i
						break
					}
				}
			} else if m.dbViewMode == DBViewTableData && m.currentScreen == ScreenDatabase {
				m.dbViewMode = DBViewTables
				m.selectedIndex = 0
				m.scrollOffset = 0
			} else if !m.sidebarFocused {
				m.sidebarFocused = true
			}

		case "tab":
			m.sidebarFocused = !m.sidebarFocused
			if !m.sidebarFocused && m.currentScreen == ScreenConfig {
				m.configInputs[m.configFocusIdx].Focus()
			}

		case "up", "k":
			if m.sidebarFocused {
				if m.menuIndex > 0 {
					m.menuIndex--
					m.currentScreen = menuItems[m.menuIndex].screen
					m.selectedIndex = 0
					m.scrollOffset = 0
				}
			} else {
				if m.selectedIndex > 0 {
					m.selectedIndex--
					if m.selectedIndex < m.scrollOffset {
						m.scrollOffset = m.selectedIndex
					}
				}
			}

		case "down", "j":
			if m.sidebarFocused {
				if m.menuIndex < len(menuItems)-1 {
					m.menuIndex++
					m.currentScreen = menuItems[m.menuIndex].screen
					m.selectedIndex = 0
					m.scrollOffset = 0
				}
			} else {
				maxIdx := m.getMaxIndex()
				if m.selectedIndex < maxIdx-1 {
					m.selectedIndex++
					visible := m.getVisibleRows()
					if m.selectedIndex >= m.scrollOffset+visible {
						m.scrollOffset = m.selectedIndex - visible + 1
					}
				}
			}

		case "enter":
			if m.sidebarFocused {
				m.sidebarFocused = false
			} else if m.currentScreen == ScreenDatabase && m.dbViewMode == DBViewTables {
				if m.selectedIndex < len(m.dbTables) {
					m.isLoading = true
					cmds = append(cmds, loadTableData(m.cfg, m.dbTables[m.selectedIndex]))
				}
			}

		case "v":
			if m.currentScreen == ScreenDatabase && m.dbViewMode == DBViewTables {
				if m.selectedIndex < len(m.dbTables) {
					m.isLoading = true
					cmds = append(cmds, loadTableData(m.cfg, m.dbTables[m.selectedIndex]))
				}
			}

		case "d", "delete":
			if m.currentScreen == ScreenDatabase && !m.sidebarFocused {
				var tableName string
				if m.dbViewMode == DBViewTables && m.selectedIndex < len(m.dbTables) {
					tableName = m.dbTables[m.selectedIndex]
				} else if m.dbViewMode == DBViewTableData {
					tableName = m.dbSelectedTable
				}
				if tableName != "" {
					m.showConfirm = true
					m.confirmMessage = fmt.Sprintf("Delete all data from '%s'? [y/n]", tableName)
					m.confirmAction = func() tea.Cmd {
						return deleteTableData(m.cfg, tableName)
					}
				}
			}

		case "r":
			m.isLoading = true
			m.statusMessage = "Refreshing..."
			switch m.currentScreen {
			case ScreenUsers:
				cmds = append(cmds, loadUsers())
			case ScreenWorkflows:
				cmds = append(cmds, loadWorkflows())
			case ScreenExecutions:
				cmds = append(cmds, loadExecutions())
			case ScreenDatabase:
				cmds = append(cmds, checkDBHealth(m.cfg), loadDBTables(m.cfg))
				if m.dbViewMode == DBViewTableData && m.dbSelectedTable != "" {
					cmds = append(cmds, loadTableData(m.cfg, m.dbSelectedTable))
				}
			default:
				if m.isAuthenticated {
					cmds = append(cmds, loadUsers(), loadWorkflows(), loadExecutions())
				}
			}

		case "c":
			txt := m.getSelectedText()
			if txt != "" {
				clipboard.WriteAll(txt)
				cmds = append(cmds, func() tea.Msg { return copyMsg{txt} })
			}

		case "ctrl+s":
			if m.currentScreen == ScreenConfig {
				m.saveConfig()
				cmds = append(cmds, func() tea.Msg { return configSavedMsg{} })
			}

		case "1", "2", "3", "4", "5", "6", "7", "8":
			idx, _ := strconv.Atoi(msg.String())
			if idx >= 1 && idx <= 8 {
				m.menuIndex = idx - 1
				m.currentScreen = menuItems[m.menuIndex].screen
				m.selectedIndex = 0
				m.scrollOffset = 0
				m.sidebarFocused = true
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m *Model) handleMouseClick(x, y int) {
	sidebarW := 18
	if x < sidebarW {
		startY := 3
		for i := range menuItems {
			if y == startY+i {
				m.menuIndex = i
				m.currentScreen = menuItems[i].screen
				m.sidebarFocused = true
				m.selectedIndex = 0
				m.scrollOffset = 0
				break
			}
		}
	} else {
		m.sidebarFocused = false
	}
}

func (m Model) getSelectedText() string {
	switch m.currentScreen {
	case ScreenUsers:
		if m.selectedIndex < len(m.users) {
			return m.users[m.selectedIndex].Email
		}
	case ScreenWorkflows:
		if m.selectedIndex < len(m.workflows) {
			return m.workflows[m.selectedIndex].Name
		}
	case ScreenExecutions:
		if m.selectedIndex < len(m.executions) {
			return m.executions[m.selectedIndex].ID
		}
	case ScreenDatabase:
		if m.dbViewMode == DBViewTables && m.selectedIndex < len(m.dbTables) {
			return m.dbTables[m.selectedIndex]
		}
	}
	return ""
}

func (m Model) getMaxIndex() int {
	switch m.currentScreen {
	case ScreenUsers:
		return len(m.users)
	case ScreenWorkflows:
		return len(m.workflows)
	case ScreenExecutions:
		return len(m.executions)
	case ScreenDatabase:
		if m.dbViewMode == DBViewTables {
			return len(m.dbTables)
		}
		return len(m.dbTableRows)
	}
	return 0
}

func (m Model) getVisibleRows() int {
	h := m.height - 12
	if h < 3 {
		h = 3
	}
	return h
}

func (m Model) handleConfigInput(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg.String() {
	case "up", "shift+tab":
		if m.configFocusIdx > 0 {
			m.configInputs[m.configFocusIdx].Blur()
			m.configFocusIdx--
			m.configInputs[m.configFocusIdx].Focus()
		}
	case "down", "tab":
		if m.configFocusIdx < len(m.configInputs)-1 {
			m.configInputs[m.configFocusIdx].Blur()
			m.configFocusIdx++
			m.configInputs[m.configFocusIdx].Focus()
		}
	case "esc":
		m.sidebarFocused = true
		m.configInputs[m.configFocusIdx].Blur()
	case "ctrl+s":
		m.saveConfig()
		cmds = append(cmds, func() tea.Msg { return configSavedMsg{} })
	default:
		var cmd tea.Cmd
		m.configInputs[m.configFocusIdx], cmd = m.configInputs[m.configFocusIdx].Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m *Model) saveConfig() {
	m.cfg.APIURL = m.configInputs[0].Value()
	if t, err := strconv.Atoi(m.configInputs[1].Value()); err == nil {
		m.cfg.Timeout = t
	}
	m.cfg.DatabaseURL = m.configInputs[2].Value()
	m.cfg.DockerContainer = m.configInputs[3].Value()
	config.Save(m.cfg)
}

// View renders the UI
func (m Model) View() string {
	if !m.ready {
		return "\n  Loading..."
	}

	if m.currentScreen == ScreenSplash && !m.splashDone {
		return m.viewSplash()
	}

	return m.viewMain()
}

func (m Model) viewSplash() string {
	// Clean, centered logo animation
	logo := []string{
		"",
		"  ██████╗  ██╗   ██╗ ███╗   ██╗ ███████╗",
		"  ██╔══██╗ ██║   ██║ ████╗  ██║ ██╔════╝",
		"  ██████╔╝ ██║   ██║ ██╔██╗ ██║ █████╗  ",
		"  ██╔══██╗ ██║   ██║ ██║╚██╗██║ ██╔══╝  ",
		"  ██║  ██║ ╚██████╔╝ ██║ ╚████║ ███████╗",
		"  ╚═╝  ╚═╝  ╚═════╝  ╚═╝  ╚═══╝ ╚══════╝",
		"",
	}

	// Calculate how many lines to show based on frame
	linesToShow := m.splashFrame / 3
	if linesToShow > len(logo) {
		linesToShow = len(logo)
	}

	var content strings.Builder
	logoStyle := lipgloss.NewStyle().Foreground(primary).Bold(true)
	dimStyle := lipgloss.NewStyle().Foreground(dim)

	for i, line := range logo {
		if i < linesToShow {
			content.WriteString(logoStyle.Render(line))
		} else {
			content.WriteString(dimStyle.Render(strings.Repeat(" ", len(line))))
		}
		content.WriteString("\n")
	}

	// Tagline
	if m.splashFrame > 15 {
		tagline := "Workflow Automation Platform"
		content.WriteString("\n")
		content.WriteString(lipgloss.NewStyle().Foreground(muted).Italic(true).Render("  " + tagline))
	}

	// Version
	if m.splashFrame > 20 {
		content.WriteString("\n\n")
		content.WriteString(lipgloss.NewStyle().Foreground(dim).Render("  v" + theme.Version))
	}

	// Skip hint
	if m.splashFrame > 25 {
		content.WriteString("\n\n\n")
		content.WriteString(lipgloss.NewStyle().Foreground(dim).Render("  Press any key to continue..."))
	}

	// Center everything
	return lipgloss.Place(
		m.width, m.height,
		lipgloss.Center, lipgloss.Center,
		content.String(),
	)
}

func (m Model) viewMain() string {
	sidebarW := 18
	contentW := m.width - sidebarW - 3
	if contentW < 40 {
		contentW = 40
	}
	mainH := m.height - 3

	sidebar := m.viewSidebar(sidebarW, mainH)
	content := m.viewContent(contentW, mainH)
	footer := m.viewFooter()

	// Confirmation overlay
	if m.showConfirm {
		content = m.viewConfirmOverlay(content, contentW, mainH)
	}

	main := lipgloss.JoinHorizontal(lipgloss.Top, sidebar, " ", content)
	return lipgloss.JoinVertical(lipgloss.Left, main, footer)
}

func (m Model) viewConfirmOverlay(base string, w, h int) string {
	dialog := lipgloss.NewStyle().
		Background(bgLight).
		Foreground(warning).
		Padding(1, 3).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(warning).
		Render(m.confirmMessage)

	return lipgloss.Place(w, h, lipgloss.Center, lipgloss.Center, dialog,
		lipgloss.WithWhitespaceBackground(bg))
}

func (m Model) viewSidebar(w, h int) string {
	var items []string

	// Title
	title := lipgloss.NewStyle().
		Foreground(primary).
		Bold(true).
		Render("  RUNE")
	items = append(items, title, "")

	// Menu
	for i, item := range menuItems {
		style := lipgloss.NewStyle().Padding(0, 1).Width(w - 2)

		label := item.key + " " + item.name

		if i == m.menuIndex {
			if m.sidebarFocused {
				style = style.Background(highlight).Foreground(text).Bold(true)
			} else {
				style = style.Foreground(primary)
			}
		} else {
			style = style.Foreground(muted)
		}

		items = append(items, style.Render(label))
	}

	content := strings.Join(items, "\n")

	boxStyle := lipgloss.NewStyle().
		Width(w).
		Height(h).
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(border).
		Padding(1, 0)

	return boxStyle.Render(content)
}

func (m Model) viewContent(w, h int) string {
	var content string

	switch m.currentScreen {
	case ScreenDashboard:
		content = m.viewDashboard(w)
	case ScreenUsers:
		content = m.viewUsers(w)
	case ScreenWorkflows:
		content = m.viewWorkflows(w)
	case ScreenExecutions:
		content = m.viewExecutions(w)
	case ScreenCredentials:
		content = m.viewPlaceholder("Credentials", "Manage API keys and secrets")
	case ScreenTemplates:
		content = m.viewPlaceholder("Templates", "Browse workflow templates")
	case ScreenDatabase:
		content = m.viewDatabase(w)
	case ScreenConfig:
		content = m.viewConfig(w)
	case ScreenHelp:
		content = m.viewHelp()
	}

	borderColor := border
	if !m.sidebarFocused {
		borderColor = primary
	}

	boxStyle := lipgloss.NewStyle().
		Width(w).
		Height(h).
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(1, 2)

	return boxStyle.Render(content)
}

func (m Model) viewFooter() string {
	// Status
	status := ""
	if m.statusMessage != "" {
		if m.isError {
			status = lipgloss.NewStyle().Foreground(danger).Render("! " + m.statusMessage)
		} else {
			status = lipgloss.NewStyle().Foreground(success).Render("+ " + m.statusMessage)
		}
	}
	if m.isLoading {
		status = m.spinner.View() + " Loading..."
	}

	// Help
	help := "Arrows:Move  Tab:Switch  r:Refresh  c:Copy  q:Quit"
	if m.currentScreen == ScreenConfig && !m.sidebarFocused {
		help = "Arrows:Field  Ctrl+S:Save  Esc:Back"
	} else if m.currentScreen == ScreenDatabase && !m.sidebarFocused {
		if m.dbViewMode == DBViewTables {
			help = "Enter:View  d:Delete  r:Refresh  Esc:Back"
		} else {
			help = "d:Delete All  r:Refresh  Esc:Tables"
		}
	}

	helpStyle := lipgloss.NewStyle().Foreground(dim)
	statusStyle := lipgloss.NewStyle().Width(m.width / 2)
	helpStyleR := lipgloss.NewStyle().Width(m.width / 2).Align(lipgloss.Right)

	footerStyle := lipgloss.NewStyle().
		Background(bgLight).
		Width(m.width).
		Padding(0, 1)

	return footerStyle.Render(
		lipgloss.JoinHorizontal(lipgloss.Top,
			statusStyle.Render(status),
			helpStyleR.Render(helpStyle.Render(help)),
		),
	)
}

// Content views

func (m Model) viewDashboard(w int) string {
	var b strings.Builder

	titleStyle := lipgloss.NewStyle().Foreground(primary).Bold(true)
	b.WriteString(titleStyle.Render("Dashboard") + "\n\n")

	// Stats row
	statStyle := func(label string, value int, color lipgloss.Color) string {
		return lipgloss.NewStyle().
			Foreground(color).
			Bold(true).
			Render(fmt.Sprintf("%d", value)) +
			lipgloss.NewStyle().Foreground(muted).Render(" "+label)
	}

	stats := []string{
		statStyle("Workflows", len(m.workflows), secondary),
		statStyle("Users", len(m.users), success),
		statStyle("Executions", len(m.executions), primary),
	}
	b.WriteString("  " + strings.Join(stats, "    ") + "\n\n")

	// Divider
	b.WriteString(lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", w-6)) + "\n\n")

	// Status section
	sectionStyle := lipgloss.NewStyle().Foreground(secondary).Bold(true)
	b.WriteString(sectionStyle.Render("System Status") + "\n\n")

	labelW := 16
	label := func(s string) string {
		return lipgloss.NewStyle().Foreground(muted).Width(labelW).Render(s)
	}

	okStyle := lipgloss.NewStyle().Foreground(success)
	warnStyle := lipgloss.NewStyle().Foreground(warning)

	// API Status
	if m.isAuthenticated {
		b.WriteString("  " + okStyle.Render("●") + " " + label("API") + m.userEmail + "\n")
	} else {
		b.WriteString("  " + warnStyle.Render("○") + " " + label("API") + "Not authenticated\n")
	}

	// Database Status
	if m.dbHealthy {
		b.WriteString("  " + okStyle.Render("●") + " " + label("Database") + m.dbMessage + "\n")
	} else {
		b.WriteString("  " + warnStyle.Render("○") + " " + label("Database") + m.dbMessage + "\n")
	}

	// Config
	b.WriteString("  " + okStyle.Render("●") + " " + label("Config") + "Loaded\n")

	// Divider
	b.WriteString("\n" + lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", w-6)) + "\n\n")

	// Quick info
	b.WriteString(sectionStyle.Render("Configuration") + "\n\n")
	b.WriteString("  " + label("API URL") + m.cfg.APIURL + "\n")
	if m.cfg.DatabaseURL != "" {
		dbURL := m.cfg.DatabaseURL
		maxLen := w - labelW - 8
		if maxLen > 0 && len(dbURL) > maxLen {
			dbURL = dbURL[:maxLen-3] + "..."
		}
		b.WriteString("  " + label("Database URL") + dbURL + "\n")
	}

	return b.String()
}

func (m Model) viewUsers(w int) string {
	var b strings.Builder

	titleStyle := lipgloss.NewStyle().Foreground(primary).Bold(true)
	b.WriteString(titleStyle.Render("Users") + "\n\n")

	if !m.isAuthenticated {
		b.WriteString(lipgloss.NewStyle().Foreground(warning).Render("Not authenticated") + "\n")
		b.WriteString(lipgloss.NewStyle().Foreground(muted).Render("Run: rune auth login") + "\n")
		return b.String()
	}

	if len(m.users) == 0 {
		b.WriteString(lipgloss.NewStyle().Foreground(muted).Render("No users found") + "\n")
		return b.String()
	}

	// Calculate column widths based on available space
	idW := 6
	roleW := 10
	statusW := 10
	emailW := w - idW - roleW - statusW - 12
	if emailW < 20 {
		emailW = 20
	}

	// Header
	headerStyle := lipgloss.NewStyle().Foreground(secondary).Bold(true)
	b.WriteString(fmt.Sprintf("  %-*s %-*s %-*s %-*s\n",
		idW, headerStyle.Render("ID"),
		emailW, headerStyle.Render("Email"),
		roleW, headerStyle.Render("Role"),
		statusW, headerStyle.Render("Status")))
	b.WriteString("  " + lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", w-6)) + "\n")

	// Rows
	visible := m.getVisibleRows()
	for i := m.scrollOffset; i < len(m.users) && i < m.scrollOffset+visible; i++ {
		u := m.users[i]

		rowStyle := lipgloss.NewStyle()
		if i == m.selectedIndex && !m.sidebarFocused {
			rowStyle = rowStyle.Background(highlight)
		}

		email := u.Email
		if len(email) > emailW {
			email = email[:emailW-3] + "..."
		}

		role := u.Role
		if role == "admin" {
			role = lipgloss.NewStyle().Foreground(warning).Render("admin")
		}

		status := lipgloss.NewStyle().Foreground(success).Render("active")
		if !u.IsActive {
			status = lipgloss.NewStyle().Foreground(muted).Render("inactive")
		}

		row := fmt.Sprintf("  %-*d %-*s %-*s %-*s",
			idW, u.ID,
			emailW, email,
			roleW, role,
			statusW, status)
		b.WriteString(rowStyle.Render(row) + "\n")
	}

	// Scroll info
	if len(m.users) > visible {
		b.WriteString(fmt.Sprintf("\n  %s",
			lipgloss.NewStyle().Foreground(dim).Render(
				fmt.Sprintf("Showing %d-%d of %d",
					m.scrollOffset+1,
					min(m.scrollOffset+visible, len(m.users)),
					len(m.users)))))
	}

	return b.String()
}

func (m Model) viewWorkflows(w int) string {
	var b strings.Builder

	titleStyle := lipgloss.NewStyle().Foreground(primary).Bold(true)
	b.WriteString(titleStyle.Render("Workflows") + "\n\n")

	if !m.isAuthenticated {
		b.WriteString(lipgloss.NewStyle().Foreground(warning).Render("Not authenticated") + "\n")
		return b.String()
	}

	if len(m.workflows) == 0 {
		b.WriteString(lipgloss.NewStyle().Foreground(muted).Render("No workflows found") + "\n")
		return b.String()
	}

	idW := 6
	statusW := 12
	nameW := w - idW - statusW - 10
	if nameW < 20 {
		nameW = 20
	}

	headerStyle := lipgloss.NewStyle().Foreground(secondary).Bold(true)
	b.WriteString(fmt.Sprintf("  %-*s %-*s %-*s\n",
		idW, headerStyle.Render("ID"),
		nameW, headerStyle.Render("Name"),
		statusW, headerStyle.Render("Status")))
	b.WriteString("  " + lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", w-6)) + "\n")

	visible := m.getVisibleRows()
	for i := m.scrollOffset; i < len(m.workflows) && i < m.scrollOffset+visible; i++ {
		wf := m.workflows[i]

		rowStyle := lipgloss.NewStyle()
		if i == m.selectedIndex && !m.sidebarFocused {
			rowStyle = rowStyle.Background(highlight)
		}

		name := wf.Name
		if len(name) > nameW {
			name = name[:nameW-3] + "..."
		}

		status := lipgloss.NewStyle().Foreground(muted).Render("draft")
		if wf.IsPublished {
			status = lipgloss.NewStyle().Foreground(success).Render("published")
		}

		row := fmt.Sprintf("  %-*d %-*s %-*s",
			idW, wf.ID,
			nameW, name,
			statusW, status)
		b.WriteString(rowStyle.Render(row) + "\n")
	}

	if len(m.workflows) > visible {
		b.WriteString(fmt.Sprintf("\n  %s",
			lipgloss.NewStyle().Foreground(dim).Render(
				fmt.Sprintf("Showing %d-%d of %d",
					m.scrollOffset+1,
					min(m.scrollOffset+visible, len(m.workflows)),
					len(m.workflows)))))
	}

	return b.String()
}

func (m Model) viewExecutions(w int) string {
	var b strings.Builder

	titleStyle := lipgloss.NewStyle().Foreground(primary).Bold(true)
	b.WriteString(titleStyle.Render("Executions") + "\n\n")

	if !m.isAuthenticated {
		b.WriteString(lipgloss.NewStyle().Foreground(warning).Render("Not authenticated") + "\n")
		return b.String()
	}

	if len(m.executions) == 0 {
		b.WriteString(lipgloss.NewStyle().Foreground(muted).Render("No executions found") + "\n")
		return b.String()
	}

	idW := 16
	wfW := 10
	statusW := 12
	triggerW := w - idW - wfW - statusW - 12
	if triggerW < 10 {
		triggerW = 10
	}

	headerStyle := lipgloss.NewStyle().Foreground(secondary).Bold(true)
	b.WriteString(fmt.Sprintf("  %-*s %-*s %-*s %-*s\n",
		idW, headerStyle.Render("ID"),
		wfW, headerStyle.Render("Workflow"),
		statusW, headerStyle.Render("Status"),
		triggerW, headerStyle.Render("Trigger")))
	b.WriteString("  " + lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", w-6)) + "\n")

	visible := m.getVisibleRows()
	for i := m.scrollOffset; i < len(m.executions) && i < m.scrollOffset+visible; i++ {
		ex := m.executions[i]

		rowStyle := lipgloss.NewStyle()
		if i == m.selectedIndex && !m.sidebarFocused {
			rowStyle = rowStyle.Background(highlight)
		}

		statusStyle := lipgloss.NewStyle().Foreground(muted)
		switch strings.ToLower(ex.Status) {
		case "completed", "success":
			statusStyle = lipgloss.NewStyle().Foreground(success)
		case "running", "pending":
			statusStyle = lipgloss.NewStyle().Foreground(primary)
		case "failed", "error":
			statusStyle = lipgloss.NewStyle().Foreground(danger)
		}

		id := ex.ID
		if len(id) > idW-2 {
			id = id[:idW-5] + "..."
		}

		row := fmt.Sprintf("  %-*s %-*d %-*s %-*s",
			idW, id,
			wfW, ex.WorkflowID,
			statusW, statusStyle.Render(ex.Status),
			triggerW, ex.TriggerType)
		b.WriteString(rowStyle.Render(row) + "\n")
	}

	return b.String()
}

func (m Model) viewDatabase(w int) string {
	if m.dbViewMode == DBViewTableData {
		return m.viewTableData(w)
	}

	var b strings.Builder

	titleStyle := lipgloss.NewStyle().Foreground(primary).Bold(true)
	b.WriteString(titleStyle.Render("Database") + "\n\n")

	// Connection info
	sectionStyle := lipgloss.NewStyle().Foreground(secondary).Bold(true)
	b.WriteString(sectionStyle.Render("Connection") + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", w-6)) + "\n\n")

	if m.cfg.DatabaseURL == "" {
		b.WriteString(lipgloss.NewStyle().Foreground(warning).Render("Database not configured") + "\n\n")
		b.WriteString("Set in Config tab or environment:\n")
		b.WriteString(lipgloss.NewStyle().Foreground(dim).Render("RUNE_DATABASE_URL=postgres://...") + "\n")
		return b.String()
	}

	labelW := 12
	label := func(s string) string {
		return lipgloss.NewStyle().Foreground(muted).Width(labelW).Render(s)
	}

	if m.dbHealthy {
		b.WriteString("  " + lipgloss.NewStyle().Foreground(success).Render("●") + " ")
	} else {
		b.WriteString("  " + lipgloss.NewStyle().Foreground(danger).Render("○") + " ")
	}
	b.WriteString(label("Status") + m.dbMessage + "\n")

	dbURL := m.cfg.DatabaseURL
	maxLen := w - labelW - 10
	if maxLen > 0 && len(dbURL) > maxLen {
		dbURL = dbURL[:maxLen-3] + "..."
	}
	b.WriteString("  " + label("URL") + lipgloss.NewStyle().Foreground(dim).Render(dbURL) + "\n\n")

	// Tables
	b.WriteString(sectionStyle.Render("Tables") + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", w-6)) + "\n\n")

	if len(m.dbTables) == 0 {
		if m.dbHealthy {
			b.WriteString(lipgloss.NewStyle().Foreground(muted).Render("No tables found") + "\n")
		} else {
			b.WriteString(lipgloss.NewStyle().Foreground(muted).Render("Connect to view tables") + "\n")
		}
		return b.String()
	}

	visible := m.getVisibleRows() - 8
	if visible < 3 {
		visible = 3
	}

	for i := m.scrollOffset; i < len(m.dbTables) && i < m.scrollOffset+visible; i++ {
		rowStyle := lipgloss.NewStyle()
		marker := "  "
		if i == m.selectedIndex && !m.sidebarFocused {
			rowStyle = rowStyle.Background(highlight)
			marker = "> "
		}
		b.WriteString(rowStyle.Render(marker+m.dbTables[i]) + "\n")
	}

	if len(m.dbTables) > visible {
		b.WriteString(fmt.Sprintf("\n  %s",
			lipgloss.NewStyle().Foreground(dim).Render(
				fmt.Sprintf("Total: %d tables", len(m.dbTables)))))
	}

	return b.String()
}

func (m Model) viewTableData(w int) string {
	var b strings.Builder

	titleStyle := lipgloss.NewStyle().Foreground(primary).Bold(true)
	b.WriteString(titleStyle.Render("Table: "+m.dbSelectedTable) + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(muted).Render(
		fmt.Sprintf("Total: %d rows (showing max 100)", m.dbTableRowCount)) + "\n\n")

	if len(m.dbTableColumns) == 0 || len(m.dbTableRows) == 0 {
		b.WriteString(lipgloss.NewStyle().Foreground(muted).Render("No data in table") + "\n")
		return b.String()
	}

	// Calculate column width
	numCols := len(m.dbTableColumns)
	colW := (w - 8) / numCols
	if colW > 25 {
		colW = 25
	}
	if colW < 8 {
		colW = 8
	}

	// Header
	headerStyle := lipgloss.NewStyle().Foreground(secondary).Bold(true)
	var headers []string
	for _, col := range m.dbTableColumns {
		c := col
		if len(c) > colW-2 {
			c = c[:colW-5] + "..."
		}
		headers = append(headers, headerStyle.Render(fmt.Sprintf("%-*s", colW, c)))
	}
	b.WriteString("  " + strings.Join(headers, " ") + "\n")
	b.WriteString("  " + lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", w-6)) + "\n")

	visible := m.getVisibleRows() - 4
	if visible < 3 {
		visible = 3
	}

	for i := m.scrollOffset; i < len(m.dbTableRows) && i < m.scrollOffset+visible; i++ {
		row := m.dbTableRows[i]

		rowStyle := lipgloss.NewStyle()
		if i == m.selectedIndex && !m.sidebarFocused {
			rowStyle = rowStyle.Background(highlight)
		}

		var cells []string
		for j, cell := range row {
			if j >= numCols {
				break
			}
			c := cell
			if len(c) > colW-2 {
				c = c[:colW-5] + "..."
			}
			cells = append(cells, fmt.Sprintf("%-*s", colW, c))
		}
		b.WriteString(rowStyle.Render("  "+strings.Join(cells, " ")) + "\n")
	}

	if len(m.dbTableRows) > visible {
		b.WriteString(fmt.Sprintf("\n  %s",
			lipgloss.NewStyle().Foreground(dim).Render(
				fmt.Sprintf("Showing %d-%d of %d",
					m.scrollOffset+1,
					min(m.scrollOffset+visible, len(m.dbTableRows)),
					len(m.dbTableRows)))))
	}

	return b.String()
}

func (m Model) viewConfig(w int) string {
	var b strings.Builder

	titleStyle := lipgloss.NewStyle().Foreground(primary).Bold(true)
	b.WriteString(titleStyle.Render("Settings") + "\n\n")

	sectionStyle := lipgloss.NewStyle().Foreground(secondary).Bold(true)
	labelStyle := lipgloss.NewStyle().Foreground(muted).Width(18)
	focusStyle := lipgloss.NewStyle().Foreground(primary).Bold(true)

	// API
	b.WriteString(sectionStyle.Render("API") + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", w-6)) + "\n\n")

	// API URL
	lbl := labelStyle.Render("API URL")
	if !m.sidebarFocused && m.configFocusIdx == 0 {
		lbl = focusStyle.Render("> API URL")
		b.WriteString("  " + lbl + "\n  " + m.configInputs[0].View() + "\n\n")
	} else {
		b.WriteString("  " + lbl + "  " + m.cfg.APIURL + "\n\n")
	}

	// Timeout
	lbl = labelStyle.Render("Timeout (sec)")
	if !m.sidebarFocused && m.configFocusIdx == 1 {
		lbl = focusStyle.Render("> Timeout (sec)")
		b.WriteString("  " + lbl + "\n  " + m.configInputs[1].View() + "\n\n")
	} else {
		b.WriteString("  " + lbl + "  " + fmt.Sprintf("%d", m.cfg.Timeout) + "\n\n")
	}

	// Database
	b.WriteString(sectionStyle.Render("Database") + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", w-6)) + "\n\n")

	// DB URL
	lbl = labelStyle.Render("Database URL")
	if !m.sidebarFocused && m.configFocusIdx == 2 {
		lbl = focusStyle.Render("> Database URL")
		b.WriteString("  " + lbl + "\n  " + m.configInputs[2].View() + "\n\n")
	} else {
		dbURL := m.cfg.DatabaseURL
		if dbURL == "" {
			dbURL = "(not set)"
		}
		maxLen := w - 26
		if maxLen > 0 && len(dbURL) > maxLen {
			dbURL = dbURL[:maxLen-3] + "..."
		}
		b.WriteString("  " + lbl + "  " + dbURL + "\n\n")
	}

	// Docker
	lbl = labelStyle.Render("Docker Container")
	if !m.sidebarFocused && m.configFocusIdx == 3 {
		lbl = focusStyle.Render("> Docker Container")
		b.WriteString("  " + lbl + "\n  " + m.configInputs[3].View() + "\n\n")
	} else {
		b.WriteString("  " + lbl + "  " + m.cfg.DockerContainer + "\n\n")
	}

	// Files
	b.WriteString(sectionStyle.Render("Files") + "\n")
	b.WriteString(lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", w-6)) + "\n\n")
	b.WriteString("  " + labelStyle.Render("Config") + "  " + lipgloss.NewStyle().Foreground(dim).Render(config.GetConfigPath()) + "\n")
	b.WriteString("  " + labelStyle.Render("Credentials") + "  " + lipgloss.NewStyle().Foreground(dim).Render(config.GetCredentialsPath()) + "\n")

	// Hint
	b.WriteString("\n")
	if !m.sidebarFocused {
		b.WriteString(lipgloss.NewStyle().Foreground(primary).Render("  Ctrl+S to save, Esc to cancel"))
	} else {
		b.WriteString(lipgloss.NewStyle().Foreground(dim).Render("  Press Tab to edit"))
	}

	return b.String()
}

func (m Model) viewHelp() string {
	var b strings.Builder

	titleStyle := lipgloss.NewStyle().Foreground(primary).Bold(true)
	b.WriteString(titleStyle.Render("Keyboard Shortcuts") + "\n\n")

	sectionStyle := lipgloss.NewStyle().Foreground(secondary).Bold(true)
	keyStyle := lipgloss.NewStyle().Foreground(primary).Width(14)

	// Navigation
	b.WriteString(sectionStyle.Render("Navigation") + "\n")
	b.WriteString(keyStyle.Render("  Up/Down") + "Move selection\n")
	b.WriteString(keyStyle.Render("  Tab") + "Switch sidebar/content\n")
	b.WriteString(keyStyle.Render("  Enter") + "Select / Open\n")
	b.WriteString(keyStyle.Render("  Esc") + "Go back\n")
	b.WriteString(keyStyle.Render("  1-8") + "Quick jump to screen\n")
	b.WriteString(keyStyle.Render("  q") + "Quit\n")

	b.WriteString("\n")
	b.WriteString(sectionStyle.Render("Actions") + "\n")
	b.WriteString(keyStyle.Render("  r") + "Refresh data\n")
	b.WriteString(keyStyle.Render("  c") + "Copy selected\n")
	b.WriteString(keyStyle.Render("  v") + "View table data\n")
	b.WriteString(keyStyle.Render("  d") + "Delete data\n")
	b.WriteString(keyStyle.Render("  Ctrl+S") + "Save config\n")
	b.WriteString(keyStyle.Render("  ?") + "Show help\n")

	b.WriteString("\n")
	b.WriteString(lipgloss.NewStyle().Foreground(muted).Render("RUNE v" + theme.Version))

	return b.String()
}

func (m Model) viewPlaceholder(title, desc string) string {
	titleStyle := lipgloss.NewStyle().Foreground(primary).Bold(true)
	return titleStyle.Render(title) + "\n\n" +
		lipgloss.NewStyle().Foreground(muted).Render(desc) + "\n\n" +
		lipgloss.NewStyle().Foreground(dim).Render("Coming soon...")
}

// Helpers
func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-3] + "..."
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Run starts the TUI
func Run() error {
	p := tea.NewProgram(
		NewModel(),
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)
	_, err := p.Run()
	return err
}
