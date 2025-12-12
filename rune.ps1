#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Rune CLI - Workflow Automation Platform Management Tool

.DESCRIPTION
    Wrapper script to run the Rune CLI from anywhere in the project.
    Automatically activates the API virtual environment.

.EXAMPLE
    .\rune.ps1 --help
    .\rune.ps1 admin inject-admin
    .\rune.ps1 db status
#>

$ErrorActionPreference = "Stop"

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Join-Path $ScriptDir "services\api"
$VenvPython = Join-Path $ApiDir ".venv\Scripts\python.exe"

# Check if venv exists
if (-not (Test-Path $VenvPython)) {
    Write-Host "Error: Virtual environment not found at $ApiDir\.venv" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set up the API environment first:" -ForegroundColor Yellow
    Write-Host "  cd services\api"
    Write-Host "  python -m venv .venv"
    Write-Host "  .\.venv\Scripts\Activate.ps1"
    Write-Host "  pip install -r requirements.txt"
    exit 1
}

# Run the CLI using the venv Python
Push-Location $ApiDir
try {
    & $VenvPython -m src.cli $args
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

exit $exitCode
