#!/usr/bin/env python3
"""
Test Runner Script for Rune Worker
Supports running unit tests, integration tests, e2e tests, or all tests.
Cross-platform compatible: Windows, macOS, Linux
"""

import argparse
import os
import platform
import subprocess
import sys
from enum import Enum
from typing import List, Optional


class TestType(Enum):
    """Available test types"""
    UNIT = "unit"
    INTEGRATION = "integration"
    E2E = "e2e"
    ALL = "all"


class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

    @staticmethod
    def disable():
        """Disable colors (for Windows CMD or non-TTY)"""
        Colors.HEADER = ''
        Colors.OKBLUE = ''
        Colors.OKCYAN = ''
        Colors.OKGREEN = ''
        Colors.WARNING = ''
        Colors.FAIL = ''
        Colors.ENDC = ''
        Colors.BOLD = ''
        Colors.UNDERLINE = ''


def is_windows():
    """Check if running on Windows"""
    return platform.system() == "Windows"


def print_header(message: str):
    """Print a formatted header"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message:^70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 70}{Colors.ENDC}\n")


def print_success(message: str):
    """Print a success message"""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")


def print_error(message: str):
    """Print an error message"""
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")


def print_info(message: str):
    """Print an info message"""
    print(f"{Colors.OKCYAN}ℹ {message}{Colors.ENDC}")


def print_warning(message: str):
    """Print a warning message"""
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")


def check_prerequisites():
    """Check if required tools are installed"""
    print_info("Checking prerequisites...")
    
    # Check Go
    try:
        result = subprocess.run(
            ["go", "version"],
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode == 0:
            print_success(f"Go installed: {result.stdout.strip()}")
        else:
            print_error("Go is not installed or not in PATH")
            return False
    except FileNotFoundError:
        print_error("Go is not installed or not in PATH")
        return False
    
    return True


def check_services(test_type: TestType):
    """Check if required services are running (for integration/e2e tests)"""
    if test_type == TestType.UNIT:
        return True
    
    print_info("Checking required services...")
    services_ok = True
    
    # Check RabbitMQ
    try:
        if is_windows():
            # Windows uses different command
            result = subprocess.run(
                ["docker", "ps", "--filter", "name=rabbitmq", "--format", "{{.Names}}"],
                capture_output=True,
                text=True,
                check=False
            )
        else:
            result = subprocess.run(
                ["docker", "ps", "--filter", "name=rabbitmq", "--format", "{{.Names}}"],
                capture_output=True,
                text=True,
                check=False
            )
        
        if result.returncode == 0 and "rabbitmq" in result.stdout:
            print_success("RabbitMQ is running")
        else:
            print_warning("RabbitMQ is not running. Integration/E2E tests may fail.")
            print_info("  Start with: docker run -d --name rabbitmq-test -p 5672:5672 -p 15672:15672 rabbitmq:4.0-management-alpine")
            services_ok = False
    except FileNotFoundError:
        print_warning("Docker not found. Cannot check RabbitMQ status.")
        services_ok = False
    
    # Check Redis
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", "name=redis", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode == 0 and "redis" in result.stdout:
            print_success("Redis is running")
        else:
            print_warning("Redis is not running. Integration/E2E tests may fail.")
            print_info("  Start with: docker run -d --name redis-test -p 6379:6379 redis:7-alpine")
            services_ok = False
    except FileNotFoundError:
        pass  # Already warned about Docker
    
    return services_ok


def run_unit_tests(verbose: bool = False, timeout: int = 30) -> bool:
    """Run unit tests (no build tags)"""
    print_header("Running Unit Tests")
    
    cmd = ["go", "test"]
    
    if verbose:
        cmd.append("-v")
    
    cmd.extend([
        f"-timeout={timeout}s",
        "./pkg/...",
        "./cmd/..."
    ])
    
    print_info(f"Command: {' '.join(cmd)}")
    
    result = subprocess.run(cmd, cwd=get_project_root())
    
    if result.returncode == 0:
        print_success("Unit tests passed!")
        return True
    else:
        print_error("Unit tests failed!")
        return False


def run_integration_tests(verbose: bool = False, timeout: int = 60, pattern: Optional[str] = None) -> bool:
    """Run integration tests"""
    print_header("Running Integration Tests")
    
    cmd = ["go", "test", "-tags=integration"]
    
    if verbose:
        cmd.append("-v")
    
    if pattern:
        cmd.extend(["-run", pattern])
    
    cmd.extend([
        f"-timeout={timeout}s",
        "./integration/"
    ])
    
    print_info(f"Command: {' '.join(cmd)}")
    
    result = subprocess.run(cmd, cwd=get_project_root())
    
    if result.returncode == 0:
        print_success("Integration tests passed!")
        return True
    else:
        print_error("Integration tests failed!")
        return False


def run_e2e_tests(verbose: bool = False, timeout: int = 120) -> bool:
    """Run E2E tests"""
    print_header("Running E2E Tests")
    
    cmd = ["go", "test", "-tags=integration"]
    
    if verbose:
        cmd.append("-v")
    
    cmd.extend([
        f"-timeout={timeout}s",
        "./e2e/"
    ])
    
    print_info(f"Command: {' '.join(cmd)}")
    
    result = subprocess.run(cmd, cwd=get_project_root())
    
    if result.returncode == 0:
        print_success("E2E tests passed!")
        return True
    else:
        print_error("E2E tests failed!")
        return False


def run_all_tests(verbose: bool = False, skip_unit: bool = False) -> bool:
    """Run all test suites"""
    print_header("Running All Tests")
    
    results = []
    
    if not skip_unit:
        results.append(("Unit Tests", run_unit_tests(verbose=verbose)))
    
    results.append(("Integration Tests", run_integration_tests(verbose=verbose)))
    results.append(("E2E Tests", run_e2e_tests(verbose=verbose)))
    
    # Print summary
    print_header("Test Summary")
    
    all_passed = True
    for name, passed in results:
        if passed:
            print_success(f"{name}: PASSED")
        else:
            print_error(f"{name}: FAILED")
            all_passed = False
    
    return all_passed


def get_project_root() -> str:
    """Get the project root directory (rune-worker)"""
    # Script is in rune-worker/scripts, so go up one level
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(script_dir)


def run_coverage(test_type: TestType) -> bool:
    """Run tests with coverage"""
    print_header(f"Running {test_type.value.title()} Tests with Coverage")
    
    coverage_file = f"coverage_{test_type.value}.out"
    
    if test_type == TestType.UNIT:
        cmd = ["go", "test", "-cover", f"-coverprofile={coverage_file}", "./pkg/...", "./cmd/..."]
    elif test_type == TestType.INTEGRATION:
        cmd = ["go", "test", "-tags=integration", "-cover", f"-coverprofile={coverage_file}", "./integration/"]
    elif test_type == TestType.E2E:
        cmd = ["go", "test", "-tags=integration", "-cover", f"-coverprofile={coverage_file}", "./e2e/"]
    else:
        print_error("Coverage not supported for 'all' test type. Run individual test types.")
        return False
    
    print_info(f"Command: {' '.join(cmd)}")
    
    result = subprocess.run(cmd, cwd=get_project_root())
    
    if result.returncode == 0:
        print_success(f"Tests passed! Coverage saved to {coverage_file}")
        print_info(f"View HTML coverage: go tool cover -html={coverage_file}")
        return True
    else:
        print_error("Tests failed!")
        return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Run Rune Worker tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s unit                    # Run unit tests
  %(prog)s integration             # Run integration tests
  %(prog)s e2e                     # Run E2E tests
  %(prog)s all                     # Run all tests
  %(prog)s integration -v          # Run with verbose output
  %(prog)s integration -p TestRedis # Run specific test pattern
  %(prog)s unit --coverage         # Run with coverage report
  %(prog)s all --skip-unit         # Run integration and e2e only
  %(prog)s --no-color              # Disable colored output
        """
    )
    
    parser.add_argument(
        "type",
        type=str,
        choices=[t.value for t in TestType],
        help="Type of tests to run"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output"
    )
    
    parser.add_argument(
        "-t", "--timeout",
        type=int,
        default=None,
        help="Test timeout in seconds (default varies by test type)"
    )
    
    parser.add_argument(
        "-p", "--pattern",
        type=str,
        help="Run only tests matching pattern (integration tests only)"
    )
    
    parser.add_argument(
        "--coverage",
        action="store_true",
        help="Run with coverage report"
    )
    
    parser.add_argument(
        "--skip-unit",
        action="store_true",
        help="Skip unit tests when running all tests"
    )
    
    parser.add_argument(
        "--skip-checks",
        action="store_true",
        help="Skip prerequisite and service checks"
    )
    
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable colored output"
    )
    
    args = parser.parse_args()
    
    # Disable colors if requested or on Windows CMD
    if args.no_color or (is_windows() and not os.environ.get('ANSICON')):
        Colors.disable()
    
    test_type = TestType(args.type)
    
    print_header(f"Rune Worker Test Runner - {test_type.value.upper()}")
    print_info(f"Platform: {platform.system()} {platform.release()}")
    print_info(f"Python: {sys.version.split()[0]}")
    
    # Check prerequisites
    if not args.skip_checks:
        if not check_prerequisites():
            sys.exit(1)
        
        if test_type != TestType.UNIT:
            check_services(test_type)
    
    # Run tests
    success = False
    
    try:
        if args.coverage:
            success = run_coverage(test_type)
        elif test_type == TestType.UNIT:
            timeout = args.timeout or 30
            success = run_unit_tests(verbose=args.verbose, timeout=timeout)
        elif test_type == TestType.INTEGRATION:
            timeout = args.timeout or 60
            success = run_integration_tests(
                verbose=args.verbose,
                timeout=timeout,
                pattern=args.pattern
            )
        elif test_type == TestType.E2E:
            timeout = args.timeout or 120
            success = run_e2e_tests(verbose=args.verbose, timeout=timeout)
        elif test_type == TestType.ALL:
            success = run_all_tests(verbose=args.verbose, skip_unit=args.skip_unit)
    except KeyboardInterrupt:
        print_warning("\n\nTests interrupted by user")
        sys.exit(130)
    
    # Exit with appropriate code
    if success:
        print(f"\n{Colors.OKGREEN}{Colors.BOLD}✓ All tests completed successfully!{Colors.ENDC}\n")
        sys.exit(0)
    else:
        print(f"\n{Colors.FAIL}{Colors.BOLD}✗ Some tests failed!{Colors.ENDC}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
