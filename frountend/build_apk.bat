@echo off
rem -------------------------------------------------------------------
rem Build script for NewsCraft Mobile Android APK
rem -------------------------------------------------------------------

set "PROJECT_ROOT=%~dp0"
pushd "%PROJECT_ROOT%"

rem Add Node.js to PATH if not already in PATH
if exist "C:\Users\maham\node-v22.13.0-win-x64" (
  set "PATH=C:\Users\maham\node-v22.13.0-win-x64;%PATH%"
) else if exist "C:\Users\maham\node-v20.11.1-win-x64" (
  set "PATH=C:\Users\maham\node-v20.11.1-win-x64;%PATH%"
)

rem Set ANDROID_HOME
if exist "%LOCALAPPDATA%\Android\Sdk" (
  set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
  set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
) else if exist "C:\Users\MOHIT\AppData\Local\Android\Sdk" (
  set "ANDROID_HOME=C:\Users\MOHIT\AppData\Local\Android\Sdk"
  set "ANDROID_SDK_ROOT=C:\Users\MOHIT\AppData\Local\Android\Sdk"
) else if exist "C:\Users\maham\AppData\Local\Android\Sdk" (
  set "ANDROID_HOME=C:\Users\maham\AppData\Local\Android\Sdk"
  set "ANDROID_SDK_ROOT=C:\Users\maham\AppData\Local\Android\Sdk"
)

rem Set JAVA_HOME if not already set or invalid
if exist "C:\Program Files\Java\jdk-17" (
  set "JAVA_HOME=C:\Program Files\Java\jdk-17"
) else if exist "C:\Program Files\Android\Android Studio\jbr" (
  set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
) else if exist "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot" (
  set "JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
)

echo [1/3] Building frontend assets...
call npm run build
if errorlevel 1 (
  echo [ERROR] Frontend build failed.
  popd
  exit /b 1
)

echo [2/3] Syncing Capacitor assets and plugins...
call node .\node_modules\@capacitor\cli\bin\capacitor sync android
if errorlevel 1 (
  echo [ERROR] Capacitor sync failed.
  popd
  exit /b 1
)

echo [3/3] Building Android APK...
cd android
call gradlew.bat clean assembleDebug
cd ..

set "APK_PATH=%PROJECT_ROOT%android\app\build\outputs\apk\debug\app-debug.apk"
set "APK_DEST=C:\Users\MOHIT\Desktop\Spotnewsv2\Spotnewsv2\APK"
if exist "%APK_PATH%" (
  echo.
  echo ===================================================
  echo [SUCCESS] APK built successfully!
  echo Location: "%APK_PATH%"
  if not exist "%APK_DEST%" mkdir "%APK_DEST%"
  copy /y "%APK_PATH%" "%APK_DEST%\Spot-News-24x7.apk" >nul
  echo Copied APK to %APK_DEST% successfully.
) else (
  echo [ERROR] APK not found after build.
)

popd
exit /b 0
