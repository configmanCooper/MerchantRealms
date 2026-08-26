# Merchant Realms — local dev launcher
# Usage:  .\start.ps1            (starts server on :3000 and opens the game)
#         .\start.ps1 -Port 3100 (use a different port)
#         .\start.ps1 -NoBrowser (server only)
param(
    [int]$Port = 3000,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

# --- node present? ---
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "ERROR: node was not found on PATH. Install Node.js and try again." -ForegroundColor Red
    exit 1
}

# --- is the port already serving Merchant Realms? ---
function Test-Port([int]$p) {
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $c.Connect('127.0.0.1', $p)
        $c.Close()
        return $true
    } catch { return $false }
}

$alreadyUp = Test-Port $Port
if ($alreadyUp) {
    Write-Host "Port $Port is already in use - assuming a server is already running." -ForegroundColor Yellow
} else {
    Write-Host "Starting Merchant Realms dev server on port $Port ..." -ForegroundColor Cyan
    $env:MR_PORT = "$Port"
    Start-Process -FilePath $node.Source -ArgumentList 'devserver.js' -WorkingDirectory $PSScriptRoot -WindowStyle Minimized

    $deadline = (Get-Date).AddSeconds(15)
    while (-not (Test-Port $Port) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }

    if (-not (Test-Port $Port)) {
        Write-Host "ERROR: server did not come up on port $Port within 15s." -ForegroundColor Red
        exit 1
    }
    Write-Host "Server is up." -ForegroundColor Green
}

$url = "http://localhost:$Port/"

Write-Host "Game URL: $url"
if (-not $NoBrowser) { Start-Process $url }
