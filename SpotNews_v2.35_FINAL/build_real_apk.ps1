# Spot News 24x7 - build the REAL app v2.35 (package com.newscraft.mobile, LIVE servers, signed with your release key)
# Your project folders are NOT changed: the project is copied to a separate build folder, the v2.35 files are
# added there, and the APK + AAB are saved next to this script.

param([string]$ProjectPath = '')
$ErrorActionPreference = 'Continue'
$Here    = $PSScriptRoot                                                 # ...\SpotNews_v2.35_FINAL
$Default = 'D:\RTI\Spot News\Code\Spotnewsv2\frountend final (1)\frountend (3)'
$Log     = Join-Path $Here 'real_build_log.txt'
Set-Content -Path $Log -Value "=== Spot News REAL build started $(Get-Date) ===" -Encoding UTF8

function Say($msg) { Write-Host $msg -ForegroundColor Cyan; Add-Content -Path $Log -Value $msg -Encoding UTF8 }
function Run($label, $cmdline, $dir) {
    Say ">>> $label"
    Push-Location $dir
    & cmd.exe /c "$cmdline 2>&1" | ForEach-Object { Write-Host $_; Add-Content -Path $Log -Value $_ -Encoding UTF8 }
    $code = $LASTEXITCODE
    Pop-Location
    Say "<<< $label finished (exit code $code)"
    return $code
}
function Fail($msg) {
    Say "BUILD FAILED: $msg"
    Say "Send a message to Claude - the log is in real_build_log.txt"
    Read-Host 'Press Enter to close'
    exit 1
}

# -- Which project to start from -----------------------------------------------
Write-Host ''
Write-Host 'Project folder to build from (the folder that has package.json and the android folder).' -ForegroundColor Yellow
Write-Host "Press Enter for: $Default" -ForegroundColor Yellow
$ans = if ($ProjectPath) { $ProjectPath } else { Read-Host 'Or paste the path of your backup copy' }
$Project = if ($ans.Trim()) { $ans.Trim().Trim('"') } else { $Default }
if (-not (Test-Path (Join-Path $Project 'package.json'))) { Fail "package.json not found in $Project" }
if (-not (Test-Path (Join-Path $Project 'android\app\build.gradle'))) { Fail "android\app\build.gradle not found in $Project" }
Say "Project: $Project"

$CodeDir = 'D:\RTI\Spot News\Code'
$Build   = if (Test-Path $CodeDir) { Join-Path $CodeDir 'SpotNews_v2.35_build' } else { Join-Path (Split-Path $Here -Parent) 'SpotNews_v2.35_build' }
if ($Build -like "$Project*") { Fail 'The build folder must not be inside the project folder.' }
$Android = Join-Path $Build 'android'

# -- Tools -----------------------------------------------------------------------
$jdk17 = $null
$jdkRoot = Join-Path $env:LOCALAPPDATA 'SpotNewsJDK'
foreach ($c in @('C:\Program Files\Java\jdk-17') + @(Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -Filter 'jdk-17*' -ErrorAction SilentlyContinue | ForEach-Object FullName) + @(Get-ChildItem $jdkRoot -Directory -Filter 'jdk-17*' -ErrorAction SilentlyContinue | ForEach-Object FullName)) {
    if ($c -and (Test-Path (Join-Path $c 'bin\java.exe'))) { $jdk17 = $c; break }
}
if (-not $jdk17) { Fail 'Java 17 not found (it was set up by APPLY_AND_BUILD_APK.bat earlier).' }
$env:JAVA_HOME = $jdk17
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (-not (Test-Path $sdk)) { Fail "Android SDK not found at $sdk" }
$env:ANDROID_HOME = $sdk; $env:ANDROID_SDK_ROOT = $sdk
$env:PATH = "$($env:JAVA_HOME)\bin;C:\Program Files\nodejs;$env:PATH"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js not found.' }

# -- 1. Copy project + v2.35 files into the build folder ---------------------------
Say "[1/6] Copying the project to $Build ..."
robocopy $Project $Build /MIR /XD node_modules dist build .gradle .git ios /XF *.apk *.aab /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy (Join-Path $Here 'frontend') $Build /E /NFL /NDL /NJH /NJS /NP | Out-Null
$admob = Join-Path $Build 'src\services\admob.service.ts'
if (Test-Path $admob) { Remove-Item $admob -Force }

# -- 2. Safety checks: LIVE servers, real app id, Firebase, release key -------------
Say '[2/6] Checking settings...'
foreach ($ef in '.env', '.env.local', '.env.production') {
    $p = Join-Path $Build $ef
    if (Test-Path $p) {
        $t = Get-Content $p -Raw
        if ($t -match 'btclwbqvnngorhyjramh' -or $t -match 'spotnews-test-') { Fail "$ef points to the TEST servers. This build must use the LIVE servers." }
        if ($t -match 'VITE_DISABLE_PUSH\s*=\s*true' -or $t -match 'VITE_APP_ENV\s*=\s*test') { Fail "$ef has TEST settings (VITE_DISABLE_PUSH / VITE_APP_ENV)." }
    }
}
$envAll = (Get-ChildItem $Build -Filter '.env*' -File | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
if ($envAll -notmatch 'rffrqokpnqoycpozrjuc') { Fail 'The LIVE Supabase address was not found in .env / .env.local.' }
if (-not (Test-Path (Join-Path $Android 'app\google-services.json'))) { Fail 'android\app\google-services.json is missing (needed for push notifications).' }
if (-not (Test-Path (Join-Path $Android 'newscraft-release.keystore'))) { Fail 'android\newscraft-release.keystore is missing (needed to sign the real app).' }

$gradleFile = Join-Path $Android 'app\build.gradle'
$g = Get-Content $gradleFile -Raw
if ($g -notmatch 'applicationId "com\.newscraft\.mobile"') { Fail 'build.gradle does not have applicationId "com.newscraft.mobile".' }
$cur = 0; if ($g -match 'versionCode (\d+)') { $cur = [int]$Matches[1] }
$code = [Math]::Max($cur + 1, 235)
$name = if ($code -eq 235) { '2.35' } else { "2.35.$($code - 235)" }
$g = $g -replace 'versionCode \d+', "versionCode $code" -replace 'versionName "[^"]*"', "versionName ""$name"""
[System.IO.File]::WriteAllText($gradleFile, $g)
Say "Version: $name (code $code; your project had code $cur)"
$sdkEsc = $sdk.Replace('\', '\\').Replace(':', '\:')
Set-Content -Path (Join-Path $Android 'local.properties') -Value "sdk.dir=$sdkEsc" -Encoding ASCII

# -- 3-6. Build ----------------------------------------------------------------------
if ((Run '[3/6] npm install' 'npm install --no-audit --no-fund' $Build) -ne 0) { Fail 'npm install' }
if ((Run '[4/6] Web build' 'npm run build' $Build) -ne 0) { Fail 'web build' }
if ((Run '[5/6] Capacitor sync' 'npx cap sync android' $Build) -ne 0) { Say 'cap sync reported a problem, continuing...' }
Run 'Stopping old Gradle daemons' 'gradlew.bat --stop' $Android | Out-Null
if ((Run '[6/6] Android build (release APK + Play Store AAB)' 'gradlew.bat assembleRelease bundleRelease' $Android) -ne 0) { Fail 'Android (Gradle) build' }

$stamp = Get-Date -Format 'MMdd-HHmm'
$apk = Join-Path $Android 'app\build\outputs\apk\release\app-release.apk'
$aab = Join-Path $Android 'app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $apk)) { Fail 'Release APK not found after the build' }
$outApk = Join-Path $Here "SpotNews-v$name-Release-$stamp.apk"
try { Copy-Item $apk $outApk -Force -ErrorAction Stop } catch { Fail "Could not save the APK: $($_.Exception.Message)" }
Say "RELEASE APK (install on phones): $outApk"
if (Test-Path $aab) {
    $outAab = Join-Path $Here "SpotNews-v$name-PlayStore-$stamp.aab"
    Copy-Item $aab $outAab -Force -ErrorAction SilentlyContinue
    Say "PLAY STORE BUNDLE (upload this): $outAab"
}
Say "=== REAL BUILD SUCCESSFUL $(Get-Date) ==="
Read-Host 'Press Enter to close'
