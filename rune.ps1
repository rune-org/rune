#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Rune CLI - Workflow Automation Platform Management Tool

.DESCRIPTION
    Wrapper script to run the Rune CLI from anywhere in the project.
    Uses CLI's own virtual environment (standalone from API).

    Architecture:
        CLI (this) --HTTP--> API Server (services/api) ---> Database
        The CLI is a standalone HTTP client that communicates with the API.
        The API server must be running for most commands to work.

.EXAMPLE
    .\rune.ps1 --help
    .\rune.ps1 auth login
    .\rune.ps1 workflow list
#>

$ErrorActionPreference = "Stop"

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CliDir = Join-Path $ScriptDir "rune_cli"

# CLI has its own venv (standalone from API)
$CliVenv = Join-Path $CliDir ".venv"
$VenvPython = Join-Path $CliVenv "Scripts\python.exe"

function Write-Info {
    param([string]$Message)
    Write-Host "i " -ForegroundColor Cyan -NoNewline
    Write-Host $Message
}

function Write-Success {
    param([string]$Message)
    Write-Host "√ " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host "! " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Error {
    param([string]$Message)
    Write-Host "X " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

function Setup-CliVenv {
    Write-Info "Setting up Rune CLI virtual environment..."
    
    # Check Python version
    try {
        $pythonVersion = & python --version 2>&1
        Write-Info "Found $pythonVersion"
    } catch {
        Write-Error "Python 3 is required but not found"
        exit 1
    }
    
    # Create venv
    Write-Info "Creating virtual environment at $CliVenv..."
    & python -m venv $CliVenv
    
    # Upgrade pip
    Write-Info "Upgrading pip..."
    & $VenvPython -m pip install --upgrade pip --quiet
    
    # Install CLI package
    Write-Info "Installing Rune CLI package..."
    & $VenvPython -m pip install -e $CliDir --quiet
    
    Write-Success "Rune CLI setup complete!"
    Write-Host ""
}

# Check if CLI venv exists, create if not
if (-not (Test-Path $VenvPython)) {
    Write-Warning "CLI virtual environment not found at $CliVenv"
    Write-Host ""
    
    $response = Read-Host "Would you like to set it up now? [Y/n]"
    if ($response -eq "" -or $response -match "^[Yy]") {
        Setup-CliVenv
    } else {
        Write-Error "Cannot run CLI without virtual environment"
        Write-Host ""
        Write-Host "To set up manually:"
        Write-Host "  cd $CliDir"
        Write-Host "  python -m venv .venv"
        Write-Host "  .\.venv\Scripts\Activate.ps1"
        Write-Host "  pip install -e ."
        exit 1
    }
}

# Run the CLI
& $VenvPython -m rune_cli $args
$exitCode = $LASTEXITCODE

exit $exitCode
