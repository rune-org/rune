# Rune CLI

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ██████╗ ██╗   ██╗███╗   ██╗███████╗                       ║
║     ██╔══██╗██║   ██║████╗  ██║██╔════╝                       ║
║     ██████╔╝██║   ██║██╔██╗ ██║█████╗                         ║
║     ██╔══██╗██║   ██║██║╚██╗██║██╔══╝                         ║
║     ██║  ██║╚██████╔╝██║ ╚████║███████╗                       ║
║     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝                       ║
║                                                               ║
║     Workflow Automation Platform - CLI                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

The Rune CLI provides a powerful command-line interface for managing your Rune workflow automation platform. Execute administrative tasks, manage users, control database operations, and more—all from your terminal.

## Installation

### From Source

```bash
cd services/api
pip install -e .
```

### Direct Usage

```bash
cd services/api
python -m src.cli.main [COMMAND]
```

Or use the convenience script:

```bash
python rune_cli.py [COMMAND]
```

## Quick Start

```bash
# Initialize configuration
rune config init

# Initialize database
rune db init

# Create admin user
rune admin inject-admin

# Login
rune auth login -e admin@rune.io --save
```

## Commands

### Admin Commands

Manage users and administrative operations.

```bash
# Create a new user
rune admin create-user -e user@example.com -n "John Doe"
rune admin create-user -e admin@example.com -n "Admin" --admin

# Inject default admin user (quick setup)
rune admin inject-admin
rune admin inject-admin -e superadmin@company.com -p SecurePass123!

# List all users
rune admin list-users
rune admin list-users --role admin
rune admin list-users --limit 10

# Delete a user
rune admin delete-user -e user@example.com
rune admin delete-user --id 5 --force

# Update user role
rune admin update-role -e user@example.com -r admin

# Reset user password
rune admin reset-password -e user@example.com
rune admin reset-password -e user@example.com -p NewPass123!
```

### Auth Commands

Manage authentication and sessions.

```bash
# Login
rune auth login -e admin@example.com
rune auth login -e admin@example.com --save  # Save token for future use

# Check authentication status
rune auth status

# Logout (clear saved credentials)
rune auth logout

# View or decode token
rune auth token
rune auth token --decode

# Refresh token
rune auth refresh

# Change password
rune auth change-password
```

### Database Commands

Manage database operations and maintenance.

```bash
# Initialize database schema
rune db init

# Reset database (WARNING: deletes all data!)
rune db reset
rune db reset --confirm --seed

# Seed database with initial data
rune db seed
rune db seed --admin-email admin@mycompany.com

# Check database status
rune db status

# View database statistics
rune db stats

# Run migrations
rune db migrate
rune db migrate -r +1

# Backup database
rune db backup
rune db backup -o backup.sql

# Truncate a table
rune db truncate -t workflows --confirm
```

### Config Commands

Manage configuration settings.

```bash
# Show current configuration
rune config show
rune config show --reveal-secrets

# Validate configuration
rune config check

# Generate secure keys
rune config generate-key
rune config generate-key --type jwt
rune config generate-key --type encryption

# Initialize .env file
rune config init
rune config init --interactive
rune config init --force

# Get/set environment variables
rune config env                          # List all
rune config env POSTGRES_HOST            # Get specific
rune config env POSTGRES_HOST --set db   # Set value
```

## Token Management

The CLI can save authentication tokens for convenience:

```bash
# Login and save token
rune auth login -e admin@example.com --save

# Token is saved to ~/.rune/credentials.json
# Future commands will use this token automatically

# Check current auth status
rune auth status

# Refresh expired token
rune auth refresh

# Clear saved credentials
rune auth logout
```

## Typical Workflows

### First-Time Setup

```bash
# 1. Initialize configuration
rune config init --interactive

# 2. Review configuration
rune config check

# 3. Initialize database
rune db init

# 4. Seed with initial data
rune db seed

# 5. Login as admin
rune auth login -e admin@rune.io --save
```

### Development Reset

```bash
# Reset database and reseed
rune db reset --confirm --seed

# Re-authenticate
rune auth login -e admin@rune.io --save
```

### User Management

```bash
# Create users
rune admin create-user -e dev1@company.com -n "Developer 1"
rune admin create-user -e dev2@company.com -n "Developer 2"

# Promote to admin
rune admin update-role -e dev1@company.com -r admin

# Reset forgotten password
rune admin reset-password -e dev2@company.com
```

## Environment Variables

The CLI respects the following environment variables (loaded from `.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | dev or prod | dev |
| `POSTGRES_HOST` | Database host | localhost |
| `POSTGRES_PORT` | Database port | 5432 |
| `POSTGRES_DB` | Database name | rune |
| `POSTGRES_USER` | Database user | postgres |
| `POSTGRES_PASSWORD` | Database password | postgres |
| `JWT_SECRET_KEY` | JWT signing key | (required) |
| `ENCRYPTION_KEY` | Data encryption key | (required) |
| `REDIS_HOST` | Redis host | localhost |
| `RABBITMQ_HOST` | RabbitMQ host | localhost |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Command line usage error |

## Security Notes

- Never commit `.env` files to version control
- Use `rune config generate-key` to create secure keys
- Token files are stored with `0600` permissions
- Use `--reveal-secrets` with caution in shared environments
- Default admin password should be changed immediately

## License

MIT License - See [LICENSE](../../LICENSE) for details.
