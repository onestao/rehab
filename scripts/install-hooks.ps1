$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$HooksDir = Join-Path $Root '.git-hooks'
$TargetDir = Join-Path $Root '.git\hooks'

if (-not (Test-Path (Join-Path $Root '.git'))) {
    Write-Error "Not a git repository: $Root"
}

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
Copy-Item -Force (Join-Path $HooksDir 'pre-push') (Join-Path $TargetDir 'pre-push')

Write-Host "Installed pre-push hook: $(Join-Path $TargetDir 'pre-push')"
