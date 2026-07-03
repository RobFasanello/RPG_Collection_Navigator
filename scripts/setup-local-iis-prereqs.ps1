param(
    [switch]$EnableIISFeatures,
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$CommandName)

    $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
    return [bool]($cmd -and $cmd.Source)
}

function Get-IISFeatureState {
    param([Parameter(Mandatory = $true)][string]$FeatureName)

    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName $FeatureName -ErrorAction Stop
        return $feature.State
    } catch {
        return "Unknown"
    }
}

function Test-UrlRewriteInstalled {
    try {
        Import-Module WebAdministration -ErrorAction Stop
        $rewrite = Get-WebGlobalModule -Name RewriteModule -ErrorAction SilentlyContinue
        return [bool]$rewrite
    } catch {
        return $false
    }
}

function Test-ArrInstalled {
    try {
        Import-Module WebAdministration -ErrorAction Stop
        $proxyNode = Get-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name '.' -ErrorAction Stop
        return $null -ne $proxyNode
    } catch {
        return $false
    }
}

function Write-Status {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][bool]$Ok,
        [string]$Details = ""
    )

    $color = if ($Ok) { 'Green' } else { 'Yellow' }
    $state = if ($Ok) { 'OK' } else { 'MISSING' }
    if ($Details) {
        Write-Host ("[{0}] {1} - {2}" -f $state, $Name, $Details) -ForegroundColor $color
    } else {
        Write-Host ("[{0}] {1}" -f $state, $Name) -ForegroundColor $color
    }
}

$requiredIisFeatures = @(
    'IIS-WebServerRole',
    'IIS-WebServer',
    'IIS-CommonHttpFeatures',
    'IIS-StaticContent'
)

if ($EnableIISFeatures) {
    if (-not (Test-IsAdministrator)) {
        throw "EnableIISFeatures requires an elevated PowerShell session (Run as Administrator)."
    }

    Write-Host "Ensuring required IIS Windows features are enabled..." -ForegroundColor Cyan
    foreach ($feature in $requiredIisFeatures) {
        Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart -ErrorAction SilentlyContinue | Out-Null
    }
}

$nodeInstalled = Test-CommandAvailable -CommandName 'node'
$npmInstalled = Test-CommandAvailable -CommandName 'npm'
$nssmInstalled = Test-CommandAvailable -CommandName 'nssm'

$iisRoleState = Get-IISFeatureState -FeatureName 'IIS-WebServerRole'
$iisEnabled = $iisRoleState -eq 'Enabled'

$urlRewriteInstalled = Test-UrlRewriteInstalled
$arrInstalled = Test-ArrInstalled

Write-Host "Local prerequisite status" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan

Write-Status -Name 'Node.js (node)' -Ok $nodeInstalled
Write-Status -Name 'npm' -Ok $npmInstalled
Write-Status -Name 'NSSM' -Ok $nssmInstalled -Details 'Install NSSM and add it to PATH if missing.'
Write-Status -Name 'IIS Web Server Role' -Ok $iisEnabled -Details ("State: {0}" -f $iisRoleState)
Write-Status -Name 'IIS URL Rewrite Module' -Ok $urlRewriteInstalled -Details 'Required for /api reverse proxy and SPA fallback rewrite.'
Write-Status -Name 'IIS ARR (Proxy section)' -Ok $arrInstalled -Details 'Required for reverse proxy forwarding to backend service.'

$missing = @()
if (-not $nodeInstalled) { $missing += 'Node.js' }
if (-not $npmInstalled) { $missing += 'npm' }
if (-not $nssmInstalled) { $missing += 'NSSM' }
if (-not $iisEnabled) { $missing += 'IIS Web Server Role' }
if (-not $urlRewriteInstalled) { $missing += 'IIS URL Rewrite Module' }
if (-not $arrInstalled) { $missing += 'IIS ARR' }

if ($missing.Count -eq 0) {
    Write-Host "All prerequisites are ready." -ForegroundColor Green
    exit 0
}

Write-Host "" 
Write-Host "Missing prerequisites:" -ForegroundColor Yellow
$missing | ForEach-Object { Write-Host (" - " + $_) -ForegroundColor Yellow }

if ($CheckOnly) {
    exit 1
}

Write-Host "" 
Write-Host "Recommended next actions:" -ForegroundColor Cyan
Write-Host "1. Install Node.js LTS if Node/npm are missing." -ForegroundColor Cyan
Write-Host "2. Install NSSM and ensure nssm.exe is on PATH." -ForegroundColor Cyan
Write-Host "3. Install IIS URL Rewrite Module 2 and ARR 3." -ForegroundColor Cyan
Write-Host "4. Re-run this script with -EnableIISFeatures (admin) if IIS role is disabled." -ForegroundColor Cyan

exit 1
