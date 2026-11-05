# Copy the final v2.35 files into YOUR copy of the project.
# Every file that gets replaced is first saved in  SpotNews_v2.35_FINAL\backup_<date-time>\  so you can undo.
# .env files, keys and passwords are never touched.

$ErrorActionPreference = 'Stop'
$Here  = $PSScriptRoot
$Stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$Bak   = Join-Path $Here "backup_$Stamp"

function CopyTree($src, $dst, $bakDir) {
    $n = 0
    Get-ChildItem $src -Recurse -File | Where-Object { $_.FullName -notmatch '\\__pycache__\\' } | ForEach-Object {
        $rel = $_.FullName.Substring($src.Length).TrimStart('\')
        $target = Join-Path $dst $rel
        if (Test-Path $target) {
            $b = Join-Path $bakDir $rel
            New-Item -ItemType Directory -Force (Split-Path $b -Parent) | Out-Null
            Copy-Item $target $b -Force
        }
        New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
        Copy-Item $_.FullName $target -Force
        $n++
    }
    return $n
}

Write-Host ''
Write-Host '1) FRONTEND: paste the folder of your app copy (the one with package.json and android).' -ForegroundColor Yellow
$fe = (Read-Host 'Frontend folder (Enter = skip)').Trim().Trim('"')
if ($fe) {
    if (-not (Test-Path (Join-Path $fe 'package.json'))) { Write-Host "package.json not found in $fe" -ForegroundColor Red; Read-Host 'Press Enter'; exit 1 }
    $n = CopyTree (Join-Path $Here 'frontend') $fe (Join-Path $Bak 'frontend')
    $admob = Join-Path $fe 'src\services\admob.service.ts'
    if (Test-Path $admob) {
        New-Item -ItemType Directory -Force (Join-Path $Bak 'frontend\src\services') | Out-Null
        Copy-Item $admob (Join-Path $Bak 'frontend\src\services\admob.service.ts') -Force
        Remove-Item $admob -Force
    }
    Write-Host "Frontend: $n files copied into $fe" -ForegroundColor Green
    Write-Host 'Then run in that folder:  npm install   (adds the new notifications plugin)' -ForegroundColor Green
}

Write-Host ''
Write-Host '2) BACKEND: paste the repository folder that contains spotnews_django and backend3.' -ForegroundColor Yellow
$be = (Read-Host 'Backend repository folder (Enter = skip)').Trim().Trim('"')
if ($be) {
    if (-not (Test-Path (Join-Path $be 'spotnews_django'))) { Write-Host "spotnews_django not found in $be" -ForegroundColor Red; Read-Host 'Press Enter'; exit 1 }
    $n = CopyTree (Join-Path $Here 'backend') $be (Join-Path $Bak 'backend')
    Write-Host "Backend: $n files copied into $be" -ForegroundColor Green
}

if (Test-Path $Bak) { Write-Host "Old versions of replaced files are saved in: $Bak" -ForegroundColor Cyan }
Read-Host 'Done. Press Enter to close'
