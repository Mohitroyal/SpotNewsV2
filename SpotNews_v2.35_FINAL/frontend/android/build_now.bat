if exist "C:\Program Files\Java\jdk-17" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-17"
) else if exist "C:\Program Files\Android\Android Studio\jbr" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)
set "ANDROID_HOME=C:\Users\MOHIT\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo JAVA_HOME set to: %JAVA_HOME%
echo ANDROID_HOME set to: %ANDROID_HOME%

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
echo === Signing Release APK ===
if exist "sign_release.bat" (
    call sign_release.bat
)

echo.
echo === BUILD COMPLETE ===
echo Checking for APKs...
dir /s /b app\build\outputs\apk\*.apk

set "DEBUG_APK=app\build\outputs\apk\debug\app-debug.apk"
set "RELEASE_APK=app\build\outputs\apk\release\app-release-final.apk"
if not exist "%RELEASE_APK%" set "RELEASE_APK=app\build\outputs\apk\release\app-release.apk"

set "APK_DIR=C:\Users\MOHIT\Desktop\Spotnewsv2\Spotnewsv2\APK"

if exist "%DEBUG_APK%" (
    copy /y "%DEBUG_APK%" "..\..\Spot-News-24x7.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "..\..\SpotNews-Latest.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "..\..\SpotNews-v2.15-Debug.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "%APK_DIR%\Spotnews_Latest.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "%APK_DIR%\SpotNews-Debug.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "%APK_DIR%\SpotNews-Debug-Latest.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "%APK_DIR%\SpotNews-v2.15-Debug.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "%APK_DIR%\SpotNews-Latest.apk" >nul 2>&1
    copy /y "%DEBUG_APK%" "%APK_DIR%\Spot-News-24x7.apk" >nul 2>&1
    echo Debug APK successfully copied to APK folder.
)

if exist "%RELEASE_APK%" (
    copy /y "%RELEASE_APK%" "..\..\Spot-News-24x7-release.apk" >nul 2>&1
    copy /y "%RELEASE_APK%" "..\..\SpotNews-v2.15-Release.apk" >nul 2>&1
    copy /y "%RELEASE_APK%" "%APK_DIR%\Spotnews_Release.apk" >nul 2>&1
    copy /y "%RELEASE_APK%" "%APK_DIR%\SpotNews-v2.15-Release.apk" >nul 2>&1
    copy /y "%RELEASE_APK%" "%APK_DIR%\SpotNews-Release-Latest.apk" >nul 2>&1
    copy /y "%RELEASE_APK%" "%APK_DIR%\SpotNews-Release.apk" >nul 2>&1
    echo Release APK successfully copied to APK folder.
)

