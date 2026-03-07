param(
    [string]$SourceDist = "..\\..\\frontend\\dist",
    [string]$TargetFrontend = "."
)

$sourceRoot = Resolve-Path -Path (Join-Path $PSScriptRoot $SourceDist)
$targetRoot = Resolve-Path -Path (Join-Path $PSScriptRoot $TargetFrontend)

$sourceAssets = Join-Path $sourceRoot "assets"
$targetAssets = Join-Path $targetRoot "assets"

if (!(Test-Path $sourceAssets)) {
    throw "Source assets directory not found: $sourceAssets"
}

New-Item -ItemType Directory -Path $targetAssets -Force | Out-Null

# Remove stale hashed files so frontend always uses matching build artifacts.
Get-ChildItem -Path $targetAssets -File -ErrorAction SilentlyContinue | Remove-Item -Force

Copy-Item -Path (Join-Path $sourceAssets "*") -Destination $targetAssets -Force

Write-Host "Synced React build assets:"
Write-Host "  From: $sourceAssets"
Write-Host "  To  : $targetAssets"
