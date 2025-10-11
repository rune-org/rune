# Scripts Directory

This directory contains utility scripts for the Rune Worker project.

## Available Scripts

### `run_tests.py`

Cross-platform test runner for Rune Worker tests. Supports Windows, macOS, and Linux.

#### Features

- ✅ Run unit, integration, E2E, or all tests
- ✅ Verbose output mode
- ✅ Custom test timeouts
- ✅ Test pattern filtering (integration tests)
- ✅ Coverage reports
- ✅ Service health checks (RabbitMQ, Redis)
- ✅ Colored terminal output
- ✅ Cross-platform compatible

#### Usage

**Basic usage:**
```bash
# Run unit tests
python3 scripts/run_tests.py unit

# Run integration tests
python3 scripts/run_tests.py integration

# Run E2E tests
python3 scripts/run_tests.py e2e

# Run all tests
python3 scripts/run_tests.py all
```

**Advanced usage:**
```bash
# Run with verbose output
python3 scripts/run_tests.py integration -v

# Run specific test pattern
python3 scripts/run_tests.py integration -p TestRedis

# Run with custom timeout (60 seconds)
python3 scripts/run_tests.py integration -t 60

# Run with coverage report
python3 scripts/run_tests.py unit --coverage

# Run all tests except unit tests
python3 scripts/run_tests.py all --skip-unit

# Auto-start Docker containers for RabbitMQ and Redis
python3 scripts/run_tests.py integration --start-services

# Run all tests with auto-start and verbose output
python3 scripts/run_tests.py all --start-services -v

# Skip prerequisite checks
python3 scripts/run_tests.py integration --skip-checks

# Disable colored output (useful for CI/CD)
python3 scripts/run_tests.py all --no-color
```

**On Unix-like systems (macOS, Linux):**
```bash
# Make executable (one time)
chmod +x scripts/run_tests.py

# Run directly
./scripts/run_tests.py unit
```

**On Windows:**
```powershell
# Run with Python
python scripts\run_tests.py unit

# Or with Python 3 explicitly
python3 scripts\run_tests.py unit
```

#### Options

| Option | Description |
|--------|-------------|
| `unit` | Run unit tests (no external dependencies) |
| `integration` | Run integration tests (requires RabbitMQ and Redis) |
| `e2e` | Run end-to-end tests (requires RabbitMQ and Redis) |
| `all` | Run all test suites |
| `-v, --verbose` | Enable verbose output |
| `-t, --timeout SECONDS` | Set test timeout (default varies by type) |
| `-p, --pattern PATTERN` | Run only tests matching pattern (integration only) |
| `--coverage` | Generate coverage report |
| `--skip-unit` | Skip unit tests when running all |
| `--skip-checks` | Skip prerequisite and service checks |
| `--start-services` | Automatically start Docker containers if not running |
| `--no-color` | Disable colored output |
| `-h, --help` | Show help message |

#### Prerequisites

**Required:**
- Python 3.6 or higher
- Go 1.21 or higher

**For Integration/E2E Tests:**
- Docker (for running RabbitMQ and Redis)
- RabbitMQ container running on port 5672/15672
- Redis container running on port 6379

#### Default Timeouts

- **Unit tests:** 30 seconds
- **Integration tests:** 60 seconds
- **E2E tests:** 120 seconds

You can override these with the `-t` flag.

#### Service Checks

Before running integration or E2E tests, the script checks if required services are running:

- **RabbitMQ:** Checks for running Docker container
- **Redis:** Checks for running Docker container

**Automatic Container Startup:**

Use the `--start-services` flag to automatically start Docker containers if they're not running:

```bash
# Script will auto-start RabbitMQ and Redis if needed
python3 scripts/run_tests.py integration --start-services
```

The script will:
1. Check if containers exist but are stopped → Start them
2. If containers don't exist → Create and start them
3. Wait a few seconds for services to be ready

**Manual Container Management:**

If services are not running and `--start-services` is not used, the script displays warnings with commands to start them manually:

```bash
# Start RabbitMQ
docker run -d --name rabbitmq-test \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:4.0-management-alpine

# Start Redis
docker run -d --name redis-test \
  -p 6379:6379 \
  redis:7-alpine
```

You can skip these checks with `--skip-checks` flag.

#### Coverage Reports

Generate coverage reports for any test type:

```bash
# Generate coverage for unit tests
python3 scripts/run_tests.py unit --coverage

# View coverage in browser
go tool cover -html=coverage_unit.out
```

Coverage files are saved as:
- `coverage_unit.out` - Unit test coverage
- `coverage_integration.out` - Integration test coverage
- `coverage_e2e.out` - E2E test coverage

#### Exit Codes

- `0` - All tests passed
- `1` - Tests failed or prerequisites not met
- `130` - Tests interrupted by user (Ctrl+C)

#### Examples

**Development workflow:**
```bash
# Quick unit test run during development
python3 scripts/run_tests.py unit

# Run integration tests for specific functionality
python3 scripts/run_tests.py integration -p TestRedisOperations -v

# Full test suite before committing
python3 scripts/run_tests.py all -v
```

**CI/CD pipeline:**
```bash
# Run all tests without colors for better log readability
python3 scripts/run_tests.py all --no-color

# Run only integration and E2E (unit tests run separately)
python3 scripts/run_tests.py all --skip-unit
```

**Debugging:**
```bash
# Run with verbose output and extended timeout
python3 scripts/run_tests.py integration -v -t 120

# Run specific failing test
python3 scripts/run_tests.py integration -p TestNodeExecutionWithMultipleNodes -v
```

#### Troubleshooting

**"Go is not installed or not in PATH"**
- Install Go: https://golang.org/dl/
- Add Go to your PATH environment variable

**"RabbitMQ is not running"**
```bash
docker run -d --name rabbitmq-test \
  -p 5672:5672 -p 15672:15672 \
  rabbitmq:4.0-management-alpine
```

**"Redis is not running"**
```bash
docker run -d --name redis-test -p 6379:6379 redis:7-alpine
```

**"Docker not found"**
- Install Docker: https://docs.docker.com/get-docker/
- Ensure Docker daemon is running

**Colors not working on Windows**
- Install Windows Terminal for better color support
- Or use `--no-color` flag

**Permission denied (Unix/Linux)**
```bash
chmod +x scripts/run_tests.py
```

#### Environment Variables

The script respects standard environment variables:
- `RABBITMQ_URL` - Custom RabbitMQ URL (passed to tests)
- `REDIS_ADDR` - Custom Redis address (passed to tests)
- `ANSICON` - Windows ANSI color support detection

#### Platform-Specific Notes

**macOS/Linux:**
- Colored output enabled by default
- Can run script directly after `chmod +x`

**Windows:**
- Use `python` or `python3` command
- Colors may not work in CMD (use PowerShell or Windows Terminal)
- Use backslashes in paths: `scripts\run_tests.py`

**CI/CD (GitHub Actions, GitLab CI, etc.):**
- Use `--no-color` for cleaner logs
- Consider using `--skip-checks` if services are managed externally
- Set appropriate timeouts for slower CI environments

## Contributing

When adding new scripts:
1. Add shebang line for Unix systems: `#!/usr/bin/env python3`
2. Make cross-platform compatible (Windows, macOS, Linux)
3. Include detailed docstrings
4. Add comprehensive error handling
5. Update this README
6. Make executable on Unix: `chmod +x scripts/your_script.py`

## Related Documentation

- [Integration Tests](../integration/README.md)
- [E2E Tests](../e2e/README.md)
- [Test Utils](../test_utils/README.md)
