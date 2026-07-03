param(
    [string]$ServiceName = "RPG-Backend",
    [string]$SiteName = "RPG Collection Navigator",
    [int]$Port = 80,
    [string]$HostHeader = "localhost",
    [string]$NssmPath = "",
    [string]$NodePath = "",
    [switch]$EnableIISFeatures,
    [switch]$ReconcileBindings,
    [switch]$UseNpmInstall,
    [switch]$ForceCloseNodeProcesses,
    [switch]$SkipBuild,
    [switch]$SkipVerification
)

$ErrorActionPreference = "Stop"

function Assert-Administrator {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "This script must be run in an elevated PowerShell session (Run as Administrator)."
    }
}

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

function Resolve-SiteBaseUrl {
    param(
        [string]$ResolvedHostHeader,
        [int]$ResolvedPort
    )

    if ([string]::IsNullOrWhiteSpace($ResolvedHostHeader) -or $ResolvedHostHeader -eq "localhost") {
        if ($ResolvedPort -eq 80) {
            return "http://localhost"
        }
        return "http://localhost:$ResolvedPort"
    }

    if ($ResolvedPort -eq 80) {
        return "http://$ResolvedHostHeader"
    }

    return "http://$ResolvedHostHeader`:$ResolvedPort"
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

function Get-NodeProcessesInPaths {
    param(
        [string[]]$CandidatePaths
    )

    $normalizedCandidates = $CandidatePaths |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        ForEach-Object { $_.TrimEnd('\\') }

    if (-not $normalizedCandidates.Count) {
        return @()
    }

    $processes = Get-CimInstance Win32_Process -Filter "name = 'node.exe' OR name = 'node'" -ErrorAction SilentlyContinue
    if (-not $processes) {
        return @()
    }

    $matches = @()
    foreach ($proc in $processes) {
        $procCommand = [string]$proc.CommandLine
        $procExe = [string]$proc.ExecutablePath

        foreach ($candidate in $normalizedCandidates) {
            if (
                ($procCommand -and ($procCommand -like "*$candidate*")) -or
                ($procExe -and ($procExe -like "*$candidate*"))
            ) {
                $matches += $proc
                break
            }
        }
    }

    return $matches
}

function Invoke-NodeProcessGuardrail {
    param(
        [string[]]$Paths,
        [switch]$ForceKill
    )

    $blockingProcesses = Get-NodeProcessesInPaths -CandidatePaths $Paths
    if (-not $blockingProcesses.Count) {
        return
    }

    if ($ForceKill) {
        Write-Warning "Detected running node processes tied to deploy paths. Forcing process stop because -ForceCloseNodeProcesses was provided."
        foreach ($proc in $blockingProcesses) {
            try {
                Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
                Write-Host "Stopped node process PID $($proc.ProcessId)." -ForegroundColor Yellow
            } catch {
                throw "Failed to stop node process PID $($proc.ProcessId): $($_.Exception.Message)"
            }
        }
        return
    }

    Write-Warning "Detected running node processes tied to deployment paths. These can lock node_modules and cause EPERM failures."
    foreach ($proc in $blockingProcesses) {
        $cmd = ([string]$proc.CommandLine)
        if ($cmd.Length -gt 180) {
            $cmd = $cmd.Substring(0, 180) + '...'
        }
        Write-Warning "PID $($proc.ProcessId): $cmd"
    }

    throw "Stop the listed node processes and re-run deployment, or run again with -ForceCloseNodeProcesses to auto-stop them."
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

function Test-Url {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [string]$Label = "Request"
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
        Write-Host "$Label OK ($($response.StatusCode)): $Url" -ForegroundColor Green
        return $true
    } catch {
        Write-Warning "$Label failed for $Url. $($_.Exception.Message)"
        if ($_.Exception.Response) {
            try {
                $resp = $_.Exception.Response
                Write-Warning ("HTTP Status: {0}" -f [int]$resp.StatusCode)
                $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
                $body = $reader.ReadToEnd()
                $reader.Close()
                if ($body.Length -gt 800) {
                    $body = $body.Substring(0, 800)
                }
                if ($body) {
                    Write-Warning ("Response excerpt: {0}" -f $body)
                }
            } catch {
                Write-Warning "Could not read response body for failed request."
            }
        }
        return $false
    }
}

Assert-Administrator

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendPath = Join-Path $repoRoot "backend"
$frontendPath = Join-Path $repoRoot "frontend"
$prereqsScript = Join-Path $PSScriptRoot "setup-local-iis-prereqs.ps1"
$installServiceScript = Join-Path $PSScriptRoot "install-backend-service.ps1"
$configureIisScript = Join-Path $PSScriptRoot "configure-iis-site.ps1"

if (-not (Test-Path $prereqsScript)) {
    throw "Missing script: $prereqsScript"
}

if (-not (Test-Path $installServiceScript)) {
    throw "Missing script: $installServiceScript"
}

if (-not (Test-Path $configureIisScript)) {
    throw "Missing script: $configureIisScript"
}

Write-Host "Validating local prerequisites..." -ForegroundColor Yellow
if ($EnableIISFeatures) {
    & $prereqsScript -EnableIISFeatures -CheckOnly
} else {
    & $prereqsScript -CheckOnly
}

$nodeExe = Resolve-ExecutablePath -ExplicitPath $NodePath -CommandName "node" -DisplayName "Node"
$nssmExe = Resolve-ExecutablePath -ExplicitPath $NssmPath -CommandName "nssm" -DisplayName "Nssm"

Write-Host "Repository root: $repoRoot" -ForegroundColor Cyan
Write-Host "Node executable: $nodeExe" -ForegroundColor Cyan
Write-Host "NSSM executable: $nssmExe" -ForegroundColor Cyan

Invoke-NodeProcessGuardrail -Paths @($repoRoot, $frontendPath, $backendPath) -ForceKill:$ForceCloseNodeProcesses

if (-not $SkipBuild) {
    Write-Host "Building backend and frontend..." -ForegroundColor Yellow

    Push-Location $backendPath
    try {
        Install-NodeDependencies -ProjectPath $backendPath -ForceNpmInstall:$UseNpmInstall
        Invoke-CheckedCommand -FilePath "npm" -Arguments @("run", "build") -Description "backend build" -MaxAttempts 1
    } finally {
        Pop-Location
    }

    Push-Location $frontendPath
    try {
        Install-NodeDependencies -ProjectPath $frontendPath -ForceNpmInstall:$UseNpmInstall
        Invoke-CheckedCommand -FilePath "npm" -Arguments @("run", "build") -Description "frontend build" -MaxAttempts 1
    } finally {
        Pop-Location
    }
} else {
    Write-Host "Skipping build step because -SkipBuild was provided." -ForegroundColor Yellow
}

Write-Host "Installing/updating backend Windows service..." -ForegroundColor Yellow
& $installServiceScript -ServiceName $ServiceName -BackendPath $backendPath -NodePath $nodeExe -NssmPath $nssmExe -UseNpmInstall:$UseNpmInstall

Write-Host "Configuring IIS site..." -ForegroundColor Yellow
$frontendDist = Join-Path $frontendPath "dist"
& $configureIisScript -SiteName $SiteName -FrontendPath $frontendDist -Port $Port -HostHeader $HostHeader -ReconcileBindings:$ReconcileBindings

$siteBaseUrl = Resolve-SiteBaseUrl -ResolvedHostHeader $HostHeader -ResolvedPort $Port

if (-not $SkipVerification) {
    Write-Host "Running deployment verification checks..." -ForegroundColor Yellow

    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $service) {
        throw "Service '$ServiceName' was not found after deployment."
    }

    Write-Host "Service status: $($service.Status)" -ForegroundColor Cyan

    $directApiOk = Test-Url -Url "http://localhost:3001/api/health" -Label "Backend health"

    $proxiedApiOk = Test-Url -Url "$siteBaseUrl/api/health" -Label "IIS proxied API"
    $frontendOk = Test-Url -Url $siteBaseUrl -Label "Frontend"

    if (-not ($directApiOk -and $proxiedApiOk -and $frontendOk)) {
        throw "One or more verification checks failed. Review warnings above."
    }
}

Write-Host "Local IIS deployment completed successfully." -ForegroundColor Green
Write-Host "Frontend URL: $siteBaseUrl" -ForegroundColor Green
Write-Host "Backend health URL: http://localhost:3001/api/health" -ForegroundColor Green
