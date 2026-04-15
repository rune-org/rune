# RUNE Admin Console

A powerful terminal user interface (TUI) for administering the RUNE Workflow Automation Platform. Built with Go and the Charm ecosystem for a beautiful, responsive terminal experience.

```
          ██████╗  ██╗   ██╗ ███╗   ██╗ ███████╗
          ██╔══██╗ ██║   ██║ ████╗  ██║ ██╔════╝
          ██████╔╝ ██║   ██║ ██╔██╗ ██║ █████╗
          ██╔══██╗ ██║   ██║ ██║╚██╗██║ ██╔══╝
          ██║  ╚██╗╚██████╔╝ ██║ ╚████║ ███████╗
          ╚═╝   ╚═╝ ╚═════╝  ╚═╝  ╚═══╝ ╚══════╝

             Workflow Automation Platform
```

## Overview

RUNE Admin Console is an administrative TUI application providing full control over your RUNE deployment:

- **User Management** - View, activate/deactivate users, manage roles
- **Workflow Management** - Monitor workflows, view status, trigger executions
- **Execution Monitoring** - Track workflow executions in real-time
- **Database Operations** - Direct database access for administration
- **System Configuration** - Configure API endpoints, database connections, and more

## Prerequisites

- Go 1.22 or later
- Access to a running RUNE API server (default: `http://localhost:8000`)
- PostgreSQL database (optional, for direct DB access mode)

## Quick Start

### Building

```bash
# Navigate to rune-cli directory
cd rune-cli

# Build the application
go build -o rune ./cmd/rune

# Or use Make
make build
```

### Running

```bash
# Launch the TUI (default when running without arguments)
./rune

# Or explicitly
./rune tui
```

### Installation

```bash
# Install to your GOBIN
go install ./cmd/rune

# Or manually copy to PATH
# Linux/macOS:
sudo cp rune /usr/local/bin/

# Windows:
# Copy rune.exe to a directory in your PATH
```

## TUI Navigation

### Keyboard Shortcuts

| Key          | Action                             |
| ------------ | ---------------------------------- |
| `↑/k`, `↓/j` | Navigate up/down                   |
| `Tab`        | Switch between sidebar and content |
| `Enter`      | Select/activate item               |
| `Esc`        | Go back / Return to sidebar        |
| `r` / `F5`   | Refresh data                       |
| `?` / `F1`   | Show help                          |
| `Ctrl+S`     | Save (in config screen)            |
| `Ctrl+Q`     | Quit application                   |

### Screens

1. **Dashboard** - System overview with stats and status indicators
2. **Users** - User management (admin only)
3. **Workflows** - View and manage workflows
4. **Executions** - Monitor workflow executions
5. **Credentials** - Manage API keys and secrets
6. **Templates** - Browse workflow templates
7. **Database** - Direct database operations (admin only)
8. **Config** - Application configuration
9. **Help** - Keyboard shortcuts and documentation

## Configuration

Configuration is stored in your system's config directory:

| Platform | Location                                         |
| -------- | ------------------------------------------------ |
| Linux    | `~/.config/rune/config.yaml`                     |
| macOS    | `~/Library/Application Support/rune/config.yaml` |
| Windows  | `%APPDATA%\rune\config.yaml`                     |

### Configuration Options

```yaml
# API Settings
api_url: http://localhost:8000
timeout: 30

# Database Settings (for direct access)
database_url: postgres://user:pass@localhost:5432/rune

# Docker Settings (for database commands)
docker_container: rune-db-1
docker_network: rune_default

# UI Preferences
color_enabled: true
output_format: text
```

### Environment Variables

All configuration options can be overridden via environment variables with the `RUNE_` prefix:

| Variable            | Description                  |
| ------------------- | ---------------------------- |
| `RUNE_API_URL`      | API server URL               |
| `RUNE_DATABASE_URL` | PostgreSQL connection string |
| `RUNE_TIMEOUT`      | Request timeout in seconds   |

## Authentication

Credentials are stored separately for security:

| Platform | Location                                              |
| -------- | ----------------------------------------------------- |
| Linux    | `~/.config/rune/credentials.json`                     |
| macOS    | `~/Library/Application Support/rune/credentials.json` |
| Windows  | `%APPDATA%\rune\credentials.json`                     |

### CLI Authentication Commands

While the TUI is the primary interface, CLI commands are available for scripting:

```bash
# Login to the API
./rune auth login

# Check authentication status
./rune auth status

# Logout
./rune auth logout
```

## CLI Commands (for Scripting)

The following commands are available for automation and scripting:

### Authentication

```bash
./rune auth login              # Interactive login
./rune auth logout             # Clear credentials
./rune auth status             # Check auth status
./rune auth signup             # Create first admin (setup only)
```

### Configuration

```bash
./rune config show             # Display configuration
./rune config set-url <url>    # Set API URL
./rune config set-db <dsn>     # Set database URL
./rune config reset            # Reset to defaults
```

### Database (Admin)

```bash
./rune db health               # Check connectivity
./rune db tables               # List tables
./rune db reset                # Reset database (destructive!)
./rune db truncate             # Truncate all tables
./rune db sql "SELECT ..."     # Execute SQL
```

### Users (Admin)

```bash
./rune users list              # List all users
./rune users get <id>          # Get user details
./rune users activate <id>     # Activate user
./rune users deactivate <id>   # Deactivate user
```

## Project Structure

```
rune-cli/
├── cmd/rune/
│   └── main.go                 # Entry point
├── internal/
│   ├── tui/                    # TUI application
│   │   ├── tui.go              # Main TUI model and views
│   │   └── components/         # Reusable UI components
│   │       └── components.go   # Logo animation, tables, cards
│   ├── theme/                  # Styling and branding
│   │   ├── colors.go           # Color palette
│   │   ├── styles.go           # Lip Gloss styles
│   │   └── logo.go             # ASCII art logos
│   ├── api/                    # HTTP API client
│   │   ├── client.go           # Base client with auth
│   │   ├── users.go            # User endpoints
│   │   └── workflows.go        # Workflow endpoints
│   ├── config/                 # Configuration management
│   │   └── config.go
│   ├── cli/                    # CLI commands (Cobra)
│   │   ├── root.go             # Root command
│   │   ├── auth.go             # Auth commands
│   │   ├── config.go           # Config commands
│   │   ├── db.go               # Database commands
│   │   └── users.go            # User commands
│   ├── db/                     # Direct PostgreSQL access
│   │   └── postgres.go
│   └── models/                 # Data types
│       └── models.go
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

## Development

### Building

```bash
# Development build
make build

# Build with version info
make build VERSION=1.0.0

# Build for all platforms
make build-all

# Run without building
go run ./cmd/rune
```

### Testing

```bash
# Run tests
make test

# Run linter
make lint

# Format code
make fmt
```

### Dependencies

| Package                                                  | Purpose                          |
| -------------------------------------------------------- | -------------------------------- |
| [Bubble Tea](https://github.com/charmbracelet/bubbletea) | TUI framework (Elm architecture) |
| [Lip Gloss](https://github.com/charmbracelet/lipgloss)   | Terminal styling                 |
| [Bubbles](https://github.com/charmbracelet/bubbles)      | TUI components                   |
| [Cobra](https://github.com/spf13/cobra)                  | CLI framework                    |
| [Viper](https://github.com/spf13/viper)                  | Configuration                    |
| [pgx](https://github.com/jackc/pgx)                      | PostgreSQL driver                |
| [Resty](https://github.com/go-resty/resty)               | HTTP client                      |

## API Compatibility

The TUI connects to the RUNE FastAPI backend. Key endpoints:

| Endpoint              | Method         | Description          |
| --------------------- | -------------- | -------------------- |
| `/api/auth/login`     | POST           | User authentication  |
| `/api/auth/refresh`   | POST           | Refresh access token |
| `/api/users/`         | GET            | List users           |
| `/api/users/{id}`     | GET/PUT/DELETE | User operations      |
| `/api/workflows/`     | GET            | List workflows       |
| `/api/workflows/{id}` | GET            | Get workflow details |
| `/api/executions/`    | GET            | List executions      |
| `/api/credentials/`   | GET            | List credentials     |
| `/api/templates/`     | GET            | List templates       |

## Troubleshooting

### TUI not displaying correctly

```bash
# Ensure terminal supports 256 colors
echo $TERM
# Should be something like: xterm-256color

# Try setting TERM
export TERM=xterm-256color
```

### Cannot connect to API

```bash
# Check current configuration
./rune config show

# Update API URL
./rune config set-url http://your-api-server:8000

# Test API connectivity
curl http://localhost:8000/api/health
```

### Authentication issues

```bash
# Clear credentials and re-authenticate
./rune auth logout
./rune auth login
```

### Database connection issues

```bash
# Test database connectivity
./rune db health

# Update database URL
./rune config set-db "postgres://user:pass@localhost:5432/rune?sslmode=disable"
```

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

For major changes, please open an issue first to discuss what you would like to change.
