param(
    [string]$ServiceName = "RPG-Backend",
    [string]$NssmPath = ""
)

$ErrorActionPreference = "Stop"

function Resolve-NssmPath {
    param([string]$ExplicitPath)

    if ($ExplicitPath -and (Test-Path $ExplicitPath)) {
        return (Resolve-Path $ExplicitPath).Path
    }

    $cmd = Get-Command "nssm" -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        return $cmd.Source
    }

    throw "NSSM not found. Provide -NssmPath or add it to PATH."
}

$NssmExe = Resolve-NssmPath -ExplicitPath $NssmPath
$serviceExists = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if (-not $serviceExists) {
    Write-Host "Service '$ServiceName' does not exist." -ForegroundColor Yellow
    exit 0
}

Write-Host "Stopping service '$ServiceName'..." -ForegroundColor Yellow
& $NssmExe stop $ServiceName | Out-Null

Write-Host "Removing service '$ServiceName'..." -ForegroundColor Yellow
& $NssmExe remove $ServiceName confirm | Out-Null

Write-Host "Service '$ServiceName' removed." -ForegroundColor Green
