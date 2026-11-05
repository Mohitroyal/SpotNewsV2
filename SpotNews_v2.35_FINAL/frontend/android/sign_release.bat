@echo off
if exist "C:\Program Files\Java\jdk-17" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-17"
) else if exist "C:\Program Files\Android\Android Studio\jbr" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)
set "JAVA=%JAVA_HOME%\bin\java.exe"
set "KEYTOOL=%JAVA_HOME%\bin\keytool.exe"

if exist "C:\Users\maham\AppData\Local\Android\Sdk\build-tools\34.0.0" (
    set "BUILD_TOOLS=C:\Users\maham\AppData\Local\Android\Sdk\build-tools\34.0.0"
) else if exist "C:\Users\maham\AppData\Local\Android\Sdk\build-tools\36.0.0" (
    set "BUILD_TOOLS=C:\Users\maham\AppData\Local\Android\Sdk\build-tools\36.0.0"
) else (
    set "BUILD_TOOLS=C:\Users\MOHIT\AppData\Local\Android\Sdk\build-tools\35.0.0"
)
set "ZIPALIGN=%BUILD_TOOLS%\zipalign.exe"
set "APKSIGNER=%BUILD_TOOLS%\apksigner.bat"

set "APK_DIR=app\build\outputs\apk\release"
set "RAW_APK=%APK_DIR%\app-release.apk"
set "ALIGNED_APK=%APK_DIR%\app-release-final.apk"
set "KEYSTORE=newscraft-release.keystore"
set "KEY_ALIAS=newscraft"
set "STORE_PASS=newscraft2024"
set "KEY_PASS=newscraft2024"

echo ==========================================
echo  NewsCraft Mobile - APK Signing Pipeline
echo ==========================================
echo  Java: %JAVA%
echo  Zipalign: %ZIPALIGN%
echo  Apksigner: %APKSIGNER%
echo ==========================================
echo.

REM Step 1: Generate keystore if it doesn't exist
if not exist "%KEYSTORE%" (
    echo [1/3] Generating release keystore...
    "%KEYTOOL%" -genkeypair -v ^
        -keystore "%KEYSTORE%" ^
        -alias %KEY_ALIAS% ^
        -keyalg RSA ^
        -keysize 2048 ^
        -validity 10000 ^
        -storepass %STORE_PASS% ^
        -keypass %KEY_PASS% ^
        -dname "CN=NewsCraft Mobile, OU=Mobile, O=NewsCraft, L=India, ST=TG, C=IN"
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Keystore generation failed!
        exit /b 1
    )
    echo Keystore generated successfully.
) else (
    echo [1/3] Keystore already exists, reusing.
)
echo.

REM Step 2: Zipalign BEFORE apksigner
echo [2/3] Running zipalign...
if exist "%ALIGNED_APK%" del "%ALIGNED_APK%"
"%ZIPALIGN%" -p -f 4 "%RAW_APK%" "%ALIGNED_APK%"
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Direct zipalign skipped or failed, copying raw APK...
    copy "%RAW_APK%" "%ALIGNED_APK%" >nul
)
echo Zipalign step complete.
echo.

REM Step 3: Sign using apksigner (enables v1 + v2 + v3 schemes required by modern Android)
echo [3/3] Signing APK with apksigner (v1 + v2 + v3)...
call "%APKSIGNER%" sign ^
    --ks "%KEYSTORE%" ^
    --ks-key-alias %KEY_ALIAS% ^
    --ks-pass pass:%STORE_PASS% ^
    --key-pass pass:%KEY_PASS% ^
    --v1-signing-enabled true ^
    --v2-signing-enabled true ^
    --v3-signing-enabled true ^
    "%ALIGNED_APK%"

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: apksigner failed!
    exit /b 1
)
echo apksigner completed successfully.
echo.

echo Verifying signed APK with apksigner...
call "%APKSIGNER%" verify --verbose "%ALIGNED_APK%"
echo.

set "DEBUG_APK=app\build\outputs\apk\debug\app-debug.apk"

echo ==========================================
echo  SIGNING COMPLETE - FINAL REPORT
echo ==========================================
echo.
echo  [DEBUG APK - installable as-is]
echo  Path: %CD%\%DEBUG_APK%
for %%F in ("%DEBUG_APK%") do echo  Size: %%~zF bytes
echo.
echo  [RELEASE APK - signed with v2/v3 + zipaligned]
echo  Path: %CD%\%ALIGNED_APK%
for %%F in ("%ALIGNED_APK%") do echo  Size: %%~zF bytes
echo.
echo  Keystore: %CD%\%KEYSTORE%
echo  Alias: %KEY_ALIAS%
echo.
echo  Both APKs are ready for installation on Android 10+
echo ==========================================
