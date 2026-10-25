@echo off
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
echo JAVA_HOME set to: %JAVA_HOME%
echo.

echo === Verifying Java ===
"%JAVA_HOME%\bin\java.exe" -version
echo.

echo === Running Gradle Clean + assembleDebug ===
call gradlew.bat clean assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo DEBUG BUILD FAILED with code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo.
echo === Running assembleRelease ===
call gradlew.bat assembleRelease
if %ERRORLEVEL% NEQ 0 (
    echo RELEASE BUILD FAILED with code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo.
echo === BUILD COMPLETE ===
echo Checking for APKs...
dir /s /b app\build\outputs\apk\*.apk

set "DEBUG_APK=app\build\outputs\apk\debug\app-debug.apk"
set "RELEASE_APK=app\build\outputs\apk\release\app-release-unsigned.apk"
if not exist "%RELEASE_APK%" set "RELEASE_APK=app\build\outputs\apk\release\app-release.apk"

if exist "%DEBUG_APK%" (
    copy /y "%DEBUG_APK%" "..\..\Spot-News-24x7.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "..\..\SpotNews-Latest.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "..\..\SpotNews-v2.10-Debug.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "..\..\APK\Spotnews_Latest.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "..\..\APK\SpotNews-Debug.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "..\..\APK\SpotNews-v2.10-Debug.apk" >nul 2>&1
    echo Debug APK successfully copied.
)

if exist "%RELEASE_APK%" (
    copy /y "%RELEASE_APK%" "..\..\Spot-News-24x7-release.apk" >nul 2>&1
    copy /y "%RELEASE_APK%" "..\..\SpotNews-Release-Latest.apk" >nul 2>&1
    copy /y "%RELEASE_APK%" "..\..\SpotNews-v2.10-Release.apk" >nul 2>&1
    copy /y "%RELEASE_APK%" "..\..\APK\Spotnews_Release.apk" >nul 2>&1
    copy /y "%RELEASE_APK%" "..\..\APK\SpotNews-v2.10-Release.apk" >nul 2>&1
    echo Release APK successfully copied.
)
