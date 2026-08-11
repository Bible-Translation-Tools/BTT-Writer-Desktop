# Builds the Windows installer on a Windows runner.
#
# The macOS build job produces the packaged (and code signed) app in
# out/BTT-Writer-win32-x64/. This script installs Inno Setup, fetches the bundled
# Git for Windows installer and compiles scripts/win_installer.iss.
#
# Inno Setup 5.5.3 is pinned on purpose: it is the version in which the .iss script relies on 5.x language files
# and constants.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$AppVersion = $env:APP_VERSION
if ([string]::IsNullOrWhiteSpace($AppVersion)) {
    throw "APP_VERSION is not set"
}
$GitVersion = if ($env:GIT_VERSION) { $env:GIT_VERSION } else { "2.33.0" }

$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $repoRoot

if (-not (Test-Path "out\BTT-Writer-win32-x64\BTT-Writer.exe")) {
    throw "Missing packaged windows app in out/BTT-Writer-win32-x64/"
}

# --- Inno Setup ---------------------------------------------------------------
$isccPath = "C:\Program Files (x86)\Inno Setup 5\ISCC.exe"
if (-not (Test-Path $isccPath)) {
    $setup = Join-Path $env:RUNNER_TEMP "isetup.exe"
    Write-Host "Downloading Inno Setup 5.5.3"
    Invoke-WebRequest -Uri "https://files.jrsoftware.org/is/5/isetup-5.5.3.exe" -OutFile $setup
    Write-Host "Installing Inno Setup"
    Start-Process -FilePath $setup -ArgumentList "/VERYSILENT", "/SP-", "/SUPPRESSMSGBOXES", "/NORESTART" -Wait -NoNewWindow
}
if (-not (Test-Path $isccPath)) {
    throw "Inno Setup compiler not found at $isccPath"
}

# --- Git for Windows (bundled by the installer) -------------------------------
New-Item -ItemType Directory -Force -Path "vendor" | Out-Null
$gitInstaller = "vendor\Git-$GitVersion-64-bit.exe"
if (-not (Test-Path $gitInstaller)) {
    Write-Host "Downloading Git $GitVersion for win64"
    Invoke-WebRequest -UseBasicParsing `
        -Uri "https://github.com/git-for-windows/git/releases/download/v$GitVersion.windows.1/Git-$GitVersion-64-bit.exe" `
        -OutFile $gitInstaller
}

# --- Compile ------------------------------------------------------------------
New-Item -ItemType Directory -Force -Path "release" | Out-Null
$destFile = "BTT-Writer-$AppVersion-win-x64"

# TRICKY: paths are relative to the .iss file, hence RootPath=../
$isccArgs = @(
    "scripts\win_installer.iss",
    "/DArch=x64",
    "/DRootPath=../",
    "/DVersion=$AppVersion",
    "/DGitVersion=$GitVersion",
    "/DDestFile=$destFile",
    "/DDestDir=release/",
    "/DBuildDir=out/"
)
Write-Host "ISCC $($isccArgs -join ' ')"
& $isccPath $isccArgs
if ($LASTEXITCODE -ne 0) {
    throw "ISCC failed with exit code $LASTEXITCODE"
}

$output = "release\$destFile.exe"
if (-not (Test-Path $output)) {
    throw "Installer was not produced at $output"
}
Write-Host "Built $output"
