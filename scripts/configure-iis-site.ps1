param(
    [string]$SiteName = "RPG Collection Navigator",
    [string]$FrontendPath = "frontend\dist",
    [int]$Port = 80,
    [string]$HostHeader = "",
    [string]$AppPoolName = "RPGCollectionNavigatorPool",
    [switch]$ReconcileBindings
)

$ErrorActionPreference = "Stop"
Import-Module WebAdministration
$appcmd = Join-Path $env:windir "System32\inetsrv\appcmd.exe"

$w3svc = Get-Service -Name "W3SVC" -ErrorAction SilentlyContinue
if (-not $w3svc) {
    throw "IIS World Wide Web Publishing Service (W3SVC) is not available. Install IIS Web Server role first."
}
if ($w3svc.Status -ne 'Running') {
    Write-Host "Starting IIS service (W3SVC)..." -ForegroundColor Yellow
    Start-Service -Name "W3SVC"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if ([System.IO.Path]::IsPathRooted($FrontendPath)) {
    $candidatePath = $FrontendPath
} else {
    $candidatePath = Join-Path $repoRoot $FrontendPath
}

if (-not (Test-Path $candidatePath)) {
    throw "Frontend path '$candidatePath' does not exist. Run 'npm --prefix frontend run build' first, or pass -FrontendPath with an absolute path."
}

$FrontendPath = (Resolve-Path $candidatePath).Path

if (-not (Test-Path (Join-Path $FrontendPath "index.html"))) {
    throw "Frontend build output not found at '$FrontendPath'. Run 'npm run build' inside frontend first."
}

if (-not (Get-WebGlobalModule -Name RewriteModule -ErrorAction SilentlyContinue)) {
    Write-Warning "IIS URL Rewrite module was not detected. Install it before enabling API proxy rules."
}

Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'enabled' -Value 'True' -ErrorAction SilentlyContinue | Out-Null

$pool = Get-ChildItem IIS:\AppPools | Where-Object { $_.Name -eq $AppPoolName }
if (-not $pool) {
    New-WebAppPool -Name $AppPoolName | Out-Null
    Write-Host "Created app pool '$AppPoolName'." -ForegroundColor Green
}

Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name managedRuntimeVersion -Value ""
Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name managedPipelineMode -Value "Integrated"

$existing = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if (-not $existing) {
    New-Website -Name $SiteName -PhysicalPath $FrontendPath -Port $Port -HostHeader $HostHeader | Out-Null
    Write-Host "Created site '$SiteName'." -ForegroundColor Green
} else {
    Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $FrontendPath
    Write-Host "Updated physical path for '$SiteName'." -ForegroundColor Green
}

Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $AppPoolName

$appPoolIdentity = "IIS AppPool\$AppPoolName"
Write-Host "Granting file permissions to IIS identities on '$FrontendPath'..." -ForegroundColor Yellow
& icacls "$FrontendPath" /grant "IUSR:(OI)(CI)(RX)" /T /C | Out-Null
& icacls "$FrontendPath" /grant "IIS_IUSRS:(OI)(CI)(RX)" /T /C | Out-Null
$appPoolGrant = "$($appPoolIdentity):(OI)(CI)(RX)"
& icacls "$FrontendPath" /grant "$appPoolGrant" /T /C | Out-Null

Write-Host "Enabling anonymous auth and disabling Windows auth for '$SiteName'..." -ForegroundColor Yellow
& $appcmd set config "$SiteName" /section:system.webServer/security/authentication/anonymousAuthentication /enabled:true /commit:apphost | Out-Null
& $appcmd set config "$SiteName" /section:system.webServer/security/authentication/windowsAuthentication /enabled:false /commit:apphost | Out-Null

$bindingInfo = '*' + ':' + $Port + ':' + $HostHeader

if ($ReconcileBindings) {
    $existingHttpBindings = Get-WebBinding -Name $SiteName -Protocol "http" -ErrorAction SilentlyContinue
    foreach ($binding in ($existingHttpBindings | Where-Object { $_.bindingInformation -ne $bindingInfo })) {
        Remove-WebBinding -Name $SiteName -Protocol "http" -BindingInformation $binding.bindingInformation
        Write-Host "Removed stale HTTP binding $($binding.bindingInformation)." -ForegroundColor Yellow
    }
}

if (-not (Get-WebBinding -Name $SiteName -Protocol "http" -ErrorAction SilentlyContinue | Where-Object { $_.bindingInformation -eq $bindingInfo })) {
    New-WebBinding -Name $SiteName -Protocol "http" -Port $Port -HostHeader $HostHeader | Out-Null
    Write-Host "Added HTTP binding $bindingInfo." -ForegroundColor Green
}

Restart-WebAppPool -Name $AppPoolName -ErrorAction SilentlyContinue
Start-WebAppPool -Name $AppPoolName -ErrorAction SilentlyContinue | Out-Null
Start-Website -Name $SiteName -ErrorAction SilentlyContinue | Out-Null

$site = Get-Website -Name $SiteName -ErrorAction Stop
Write-Host "Site state: $($site.State)" -ForegroundColor Cyan

Write-Host "IIS site '$SiteName' configured to serve '$FrontendPath'." -ForegroundColor Green
Write-Host "Verify web.config exists in dist for rewrite/proxy support." -ForegroundColor Yellow
