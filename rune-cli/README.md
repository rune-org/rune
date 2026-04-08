# RUNE CLI

A professional command-line interface for the RUNE Workflow Automation Platform, built with Go and the Charm ecosystem (Bubble Tea, Lip Gloss, Bubbles).

```
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║        ██████╗ ██╗   ██╗███╗   ██╗███████╗               ║
║        ██╔══██╗██║   ██║████╗  ██║██╔════╝               ║
║        ██████╔╝██║   ██║██╔██╗ ██║█████╗                 ║
║        ██╔══██╗██║   ██║██║╚██╗██║██╔══╝                 ║
║        ██║  ██║╚██████╔╝██║ ╚████║███████╗               ║
║        ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝               ║
║                                                          ║
║      Workflow Automation Platform                        ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

## Features

- **Interactive TUI Mode**: Full-screen terminal interface with keyboard navigation
- **Traditional CLI**: Scriptable commands for automation and CI/CD pipelines
- **Dual Data Access**:
  - HTTP API client (connects to FastAPI backend)
  - Direct PostgreSQL access (admin/development mode)
- **Beautiful Branding**: RUNE-themed colors, ASCII art logos, and styled output

## Prerequisites

- Go 1.22 or later
- Access to a running RUNE API server (default: `http://localhost:8000`)
- PostgreSQL database (for direct DB access mode)

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/your-org/rune.git
cd rune/rune-cli

# Build the CLI
make build

# Or build manually
go build -o rune ./cmd/rune
```

### Install to PATH

```bash
# Linux/macOS
make install  # Installs to /usr/local/bin

# Or manually
sudo cp rune /usr/local/bin/
```

## Quick Start

```bash
# Show help and available commands
rune --help

# Launch interactive TUI
rune tui
# Or just run without arguments (defaults to showing help)
rune

# Login to the API
rune auth login

# Check authentication status
rune auth status

# View current configuration
rune config show
```

## Commands

### Root Commands

| Command   | Description                          |
|-----------|--------------------------------------|
| `version` | Show version information             |
| `tui`     | Launch interactive TUI mode          |
| `help`    | Help about any command               |

### Authentication (`auth`)

```bash
rune auth login              # Login with email/password
rune auth logout             # Clear stored credentials
rune auth status             # Check if authenticated
rune auth signup             # Create first admin account (setup only)
```

### Configuration (`config`)

```bash
rune config show             # Display current configuration
rune config set-url <url>    # Set API server URL
rune config set-db <dsn>     # Set database connection string
rune config reset            # Reset to defaults
```

### Database Operations (`db`)

Direct database access for development and administration.

```bash
rune db health               # Check database connectivity
rune db tables               # List all database tables
rune db reset                # Reset database (drops all data!)
rune db truncate             # Truncate all tables
rune db sql "SELECT ..."     # Execute raw SQL queries
```

**Warning**: Database commands bypass API authentication and should only be used in development or by administrators.

### User Management (`users`)

```bash
rune users list              # List all users
rune users get <id>          # Get user details
rune users activate <id>     # Activate a user
rune users deactivate <id>   # Deactivate a user
```

## Configuration

Configuration is stored in `~/.config/rune/config.yaml`:

```yaml
api_url: http://localhost:8000
timeout: 30
database_url: ""
color_enabled: true
output_format: text
docker_container: rune-db-1
docker_network: rune_default
```

Credentials are stored separately in `~/.config/rune/credentials.json`:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_at": "2024-01-01T00:00:00Z"
}
```

## Environment Variables

| Variable           | Description                    | Default                  |
|--------------------|--------------------------------|--------------------------|
| `RUNE_API_URL`     | API server URL                 | `http://localhost:8000`  |
| `RUNE_DB_URL`      | PostgreSQL connection string   | (none)                   |
| `RUNE_NO_COLOR`    | Disable colored output         | `false`                  |
| `RUNE_OUTPUT`      | Output format (`text`/`json`)  | `text`                   |

## Global Flags

| Flag          | Description                |
|---------------|----------------------------|
| `--help, -h`  | Show help                  |
| `--json, -j`  | Output in JSON format      |
| `--verbose, -v` | Enable verbose output    |
| `--no-color`  | Disable colored output     |

## Interactive TUI

Launch the TUI with `rune tui` for a full-screen interface:

```
┌─────────────────────────────────────────────────────────────┐
│  ╦═╗╦ ╦╔╗╔╔═╗                                               │
│  ╠╦╝║ ║║║║║╣                                                │
│  ╩╚═╚═╝╝╚╝╚═╝                                               │
├─────────────┬───────────────────────────────────────────────┤
│  Dashboard  │                                               │
│  Workflows  │   Welcome to RUNE CLI!                        │
│  Users      │                                               │
│  Settings   │   Select an option from the sidebar           │
│             │   to get started.                             │
│             │                                               │
├─────────────┴───────────────────────────────────────────────┤
│  ↑/↓: Navigate  Enter: Select  q: Quit  ?: Help             │
└─────────────────────────────────────────────────────────────┘
```

### TUI Keyboard Shortcuts

| Key       | Action                     |
|-----------|----------------------------|
| `↑/k`     | Move up                    |
| `↓/j`     | Move down                  |
| `Enter`   | Select item                |
| `Tab`     | Switch panels              |
| `?`       | Show help                  |
| `q`       | Quit                       |
| `Ctrl+C`  | Force quit                 |

## Development

### Project Structure

```
rune-cli/
├── cmd/rune/main.go              # Entry point
├── go.mod                        # Go module definition
├── Makefile                      # Build commands
└── internal/
    ├── theme/                    # RUNE branding and styles
    │   ├── colors.go             # Color palette
    │   ├── styles.go             # Lip Gloss styles
    │   └── logo.go               # ASCII art logos
    ├── config/                   # Configuration management
    │   └── config.go
    ├── models/                   # Data types
    │   └── models.go
    ├── api/                      # HTTP API client
    │   ├── client.go             # Base client with auth
    │   ├── users.go              # User endpoints
    │   └── workflows.go          # Workflow endpoints
    ├── db/                       # Direct PostgreSQL access
    │   └── postgres.go
    ├── cli/                      # Cobra commands
    │   ├── root.go
    │   ├── auth.go
    │   ├── config.go
    │   ├── db.go
    │   └── users.go
    └── app/                      # Bubble Tea TUI
        └── app.go
```

### Building

```bash
# Build for current platform
make build

# Build with version info
make build VERSION=1.0.0

# Build for all platforms
make build-all

# Run tests
make test

# Run linter
make lint

# Clean build artifacts
make clean
```

### Running in Development

```bash
# Run without building
go run ./cmd/rune

# Run with hot reload (requires air)
air
```

### Dependencies

- [Cobra](https://github.com/spf13/cobra) - CLI framework
- [Viper](https://github.com/spf13/viper) - Configuration management
- [Bubble Tea](https://github.com/charmbracelet/bubbletea) - TUI framework
- [Bubbles](https://github.com/charmbracelet/bubbles) - TUI components
- [Lip Gloss](https://github.com/charmbracelet/lipgloss) - Style definitions
- [pgx](https://github.com/jackc/pgx) - PostgreSQL driver
- [Resty](https://github.com/go-resty/resty) - HTTP client

## API Compatibility

This CLI is designed to work with the RUNE FastAPI backend. Key endpoints used:

| Endpoint                | Method | Description              |
|-------------------------|--------|--------------------------|
| `/api/auth/login`       | POST   | User authentication      |
| `/api/auth/refresh`     | POST   | Refresh access token     |
| `/api/users/`           | GET    | List users               |
| `/api/users/{id}`       | GET    | Get user details         |
| `/api/workflows/`       | GET    | List workflows           |
| `/api/workflows/{id}`   | GET    | Get workflow details     |
| `/api/setup/status`     | GET    | Check setup status       |

## Troubleshooting

### Cannot connect to API

```bash
# Check API URL configuration
rune config show

# Test API connectivity
curl http://localhost:8000/api/health

# Update API URL
rune config set-url http://your-api-server:8000
```

### Authentication errors

```bash
# Clear stored credentials and re-login
rune auth logout
rune auth login
```

### Database connection issues

```bash
# Test database connectivity
rune db health

# Set database URL
rune config set-db "postgres://user:pass@localhost:5432/rune?sslmode=disable"
```

### Colors not displaying

Some terminals don't support colors. Try:

```bash
# Disable colors
rune --no-color <command>

# Or set environment variable
export RUNE_NO_COLOR=true
```

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

For major changes, please open an issue first to discuss the proposed changes.
