@echo off
REM Build script for Android APK (Windows)

setlocal enabledelayedexpansion

echo Building Tetra Overflow Ultra APK...

REM Navigate to android directory
cd /d "%~dp0\..\android"

REM Check for Java
java -version >nul 2>&1
if errorlevel 1 (
    echo Error: Java not found. Please install JDK 17 or higher.
    exit /b 1
)

REM Check for gradle wrapper
if not exist "gradlew.bat" (
    echo Error: Gradle wrapper not found.
    exit /b 1
)

REM Clean previous builds
echo Cleaning previous builds...
call gradlew.bat clean

REM Build based on argument
set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=release

if "%BUILD_TYPE%"=="debug" (
    echo Building DEBUG APK...
    call gradlew.bat assembleDebug
    set "APK_PATH=app\build\outputs\apk\debug\app-debug.apk"
) else (
    echo Building RELEASE APK...
    
    REM Check for keystore
    if not exist "keystore.properties" (
        echo Warning: keystore.properties not found. Building unsigned APK.
    )
    
    call gradlew.bat assembleRelease
    
    REM Determine output path
    if exist "app\build\outputs\apk\release\app-release.apk" (
        set "APK_PATH=app\build\outputs\apk\release\app-release.apk"
    ) else (
        set "APK_PATH=app\build\outputs\apk\release\app-release-unsigned.apk"
    )
)

REM Check if build succeeded
if exist "%APK_PATH%" (
    echo Build successful!
    echo APK: %APK_PATH%
    
    REM Copy to public directory for serving
    if not exist "..\public\downloads" mkdir "..\public\downloads"
    copy "%APK_PATH%" "..\public\downloads\tetra-overflow-ultra-%BUILD_TYPE%.apk"
    echo Copied to: public\downloads\tetra-overflow-ultra-%BUILD_TYPE%.apk
) else (
    echo Build failed. APK not found at expected path.
    exit /b 1
)

echo.
echo Done!
