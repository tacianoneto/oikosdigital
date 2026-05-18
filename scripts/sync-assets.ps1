$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$publicAssets = Join-Path $root "apps\web\public\assets"

New-Item -ItemType Directory -Force -Path $publicAssets | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $publicAssets "boards") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $publicAssets "forest-cards") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $publicAssets "forest-cards\initial") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $publicAssets "meeples") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $publicAssets "resources") | Out-Null

Copy-Item -Path (Join-Path $root "boards\*.png") -Destination (Join-Path $publicAssets "boards") -Force
Copy-Item -Path (Join-Path $root "cartas floresta\*.png") -Destination (Join-Path $publicAssets "forest-cards") -Force
Copy-Item -Path (Join-Path $root "cartas floresta\cartas iniciais floresta\*.png") -Destination (Join-Path $publicAssets "forest-cards\initial") -Force
Copy-Item -Path (Join-Path $root "meeples\*.png") -Destination (Join-Path $publicAssets "meeples") -Force
Copy-Item -Path (Join-Path $root "recursos\*.png") -Destination (Join-Path $publicAssets "resources") -Force

Write-Host "Assets synced to $publicAssets"
