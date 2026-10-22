@echo off
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
set "JAVA=%JAVA_HOME%\bin\java.exe"
set "KEYTOOL=%JAVA_HOME%\bin\keytool.exe"
set "JARSIGNER=%JAVA_HOME%\bin\jarsigner.exe"
set "BUILD_TOOLS=C:\Users\MOHIT\AppData\Local\Android\Sdk\build-tools\35.0.0"
set "ZIPALIGN=%BUILD_TOOLS%\zipalign.exe"

set "APK_DIR=app\build\outputs\apk\release"
set "UNSIGNED_APK=%APK_DIR%\app-release-unsigned.apk"
set "SIGNED_APK=%APK_DIR%\app-release.apk"
set "KEYSTORE=newscraft-release.keystore"
set "KEY_ALIAS=newscraft"
set "STORE_PASS=newscraft2024"
set "KEY_PASS=newscraft2024"

echo ==========================================
echo  NewsCraft Mobile - APK Signing Pipeline
echo ==========================================
echo  Java: %JAVA%
echo  Jarsigner: %JARSIGNER%
echo  Zipalign: %ZIPALIGN%
echo ==========================================
echo.

REM Step 1: Generate keystore if it doesn't exist
if not exist "%KEYSTORE%" (
    echo [1/4] Generating release keystore...
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
    echo [1/4] Keystore already exists, reusing.
)
echo.

REM Step 2: Use Gradle's release APK or sign with apksigner if unsigned
set "APKSIGNER=%BUILD_TOOLS%\apksigner.bat"
set "FINAL_APK=%APK_DIR%\app-release-final.apk"

if exist "%UNSIGNED_APK%" (
    echo [2/3] Zipaligning unsigned APK...
    set "ALIGNED_APK=%APK_DIR%\app-release-aligned.apk"
    if exist "%ALIGNED_APK%" del "%ALIGNED_APK%"
    "%ZIPALIGN%" -v -p 4 "%UNSIGNED_APK%" "%ALIGNED_APK%"
    
    echo [3/3] Signing with apksigner v1 and v2 and v3...
    if exist "%FINAL_APK%" del "%FINAL_APK%"
    call "%APKSIGNER%" sign ^
        --ks "%KEYSTORE%" ^
        --ks-key-alias %KEY_ALIAS% ^
        --ks-pass pass:%STORE_PASS% ^
        --key-pass pass:%KEY_PASS% ^
        --v1-signing-enabled true ^
        --v2-signing-enabled true ^
        --v3-signing-enabled true ^
        --out "%FINAL_APK%" ^
        "%ALIGNED_APK%"
) else (
    echo [2/2] Using Gradle signed release APK with v2 signature...
    copy /y "%SIGNED_APK%" "%FINAL_APK%" >nul
)

echo Verifying signature with apksigner...
call "%APKSIGNER%" verify --verbose "%FINAL_APK%"

REM Copy debug APK to a convenient location
set "DEBUG_APK=app\build\outputs\apk\debug\app-debug.apk"

echo ==========================================
echo  SIGNING COMPLETE - FINAL REPORT
echo ==========================================
echo.
echo  [DEBUG APK - installable as-is]
echo  Path: %CD%\%DEBUG_APK%
for %%F in ("%DEBUG_APK%") do echo  Size: %%~zF bytes
echo.
echo  [RELEASE APK - signed + zipaligned]
echo  Path: %CD%\%FINAL_APK%
for %%F in ("%FINAL_APK%") do echo  Size: %%~zF bytes
echo.
echo  Keystore: %CD%\%KEYSTORE%
echo  Alias: %KEY_ALIAS%
echo  Password: %STORE_PASS%
echo.
echo  Both APKs are ready for installation on Android 10+
echo ==========================================
