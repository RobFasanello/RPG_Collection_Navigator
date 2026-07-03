param(
    [string]$ServiceName = "RPG-Backend",
    [string]$BackendPath = (Join-Path $PSScriptRoot "..\backend"),
    [string]$NodePath = "",
    [string]$NssmPath = "",
    [switch]$UseNpmInstall,
    [string]$StartupType = "SERVICE_AUTO_START"
)

$ErrorActionPreference = "Stop"

function Resolve-ExecutablePath {
    param(
        [string]$ExplicitPath,
        [string]$CommandName,
        [string]$DisplayName
    )

    if ($ExplicitPath -and (Test-Path $ExplicitPath)) {
        return (Resolve-Path $ExplicitPath).Path
    }

    $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
        return $cmd.Source
    }

    throw "$DisplayName not found. Provide -${DisplayName}Path or add it to PATH."
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$Description = "Command",
        [int]$MaxAttempts = 1
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        if ($Arguments.Count -gt 0) {
            & $FilePath @Arguments
        } else {
            & $FilePath
        }

        if ($LASTEXITCODE -eq 0) {
            return
        }

        if ($attempt -lt $MaxAttempts) {
            Write-Warning "$Description failed on attempt $attempt/$MaxAttempts (exit code $LASTEXITCODE). Retrying..."
        }
    }

    throw "$Description failed after $MaxAttempts attempt(s)."
}

function Install-NodeDependencies {
    param(
        [string]$ProjectPath,
        [switch]$ForceNpmInstall
    )

    $lockFilePath = Join-Path $ProjectPath "package-lock.json"
    if ($ForceNpmInstall -or -not (Test-Path $lockFilePath)) {
        if (-not (Test-Path $lockFilePath)) {
            Write-Warning "No package-lock.json found at '$ProjectPath'. Falling back to npm install."
        }
        Invoke-CheckedCommand -FilePath "npm" -Arguments @("install") -Description "npm install in $ProjectPath" -MaxAttempts 3
        return
    }

    Invoke-CheckedCommand -FilePath "npm" -Arguments @("ci") -Description "npm ci in $ProjectPath" -MaxAttempts 3
}

$BackendPath = (Resolve-Path $BackendPath).Path
$NodeExe = Resolve-ExecutablePath -ExplicitPath $NodePath -CommandName "node" -DisplayName "Node"
$NssmExe = Resolve-ExecutablePath -ExplicitPath $NssmPath -CommandName "nssm" -DisplayName "Nssm"

Write-Host "Using backend path: $BackendPath" -ForegroundColor Cyan
Write-Host "Using Node executable: $NodeExe" -ForegroundColor Cyan
Write-Host "Using NSSM executable: $NssmExe" -ForegroundColor Cyan

Push-Location $BackendPath
try {
    Write-Host "Installing backend dependencies (if needed)..." -ForegroundColor Yellow
    Install-NodeDependencies -ProjectPath $BackendPath -ForceNpmInstall:$UseNpmInstall

    Write-Host "Building backend..." -ForegroundColor Yellow
    Invoke-CheckedCommand -FilePath "npm" -Arguments @("run", "build") -Description "backend build" -MaxAttempts 1
}
finally {
    Pop-Location
}

$serviceExists = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($serviceExists) {
    Write-Host "Service '$ServiceName' already exists. Updating configuration..." -ForegroundColor Yellow
} else {
    & $NssmExe install $ServiceName $NodeExe "dist/server.js"
}

& $NssmExe set $ServiceName AppDirectory $BackendPath
& $NssmExe set $ServiceName AppParameters "dist/server.js"
& $NssmExe set $ServiceName Start $StartupType
& $NssmExe set $ServiceName AppStdout (Join-Path $BackendPath "logs\\service-stdout.log")
& $NssmExe set $ServiceName AppStderr (Join-Path $BackendPath "logs\\service-stderr.log")
& $NssmExe set $ServiceName AppRotateFiles 1
& $NssmExe set $ServiceName AppRotateOnline 1
& $NssmExe set $ServiceName AppRotateSeconds 86400

$envFile = Join-Path $BackendPath ".env"
if (Test-Path $envFile) {
    Write-Host "Applying environment variables from .env to service..." -ForegroundColor Yellow
    $envLines = Get-Content $envFile |
        Where-Object { $_ -and -not $_.Trim().StartsWith("#") -and $_ -match "=" }

    if ($envLines.Count -gt 0) {
        $multi = [string]::Join("`0", $envLines) + "`0"
        & $NssmExe set $ServiceName AppEnvironmentExtra $multi
    }
}

$logsPath = Join-Path $BackendPath "logs"
if (-not (Test-Path $logsPath)) {
    New-Item -ItemType Directory -Path $logsPath | Out-Null
}

Write-Host "Restarting service..." -ForegroundColor Yellow
& $NssmExe stop $ServiceName | Out-Null
& $NssmExe start $ServiceName | Out-Null

Write-Host "Service '$ServiceName' is installed and started." -ForegroundColor Green
Write-Host "Check status with: Get-Service -Name $ServiceName" -ForegroundColor Green
