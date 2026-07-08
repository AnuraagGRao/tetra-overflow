#!/bin/bash
# Build script for Android APK

set -e

echo "🔨 Building Tetra Overflow Ultra APK..."

# Navigate to android directory
cd "$(dirname "$0")/../android"

# Check for Java
if ! command -v java &> /dev/null; then
    echo "❌ Error: Java not found. Please install JDK 17 or higher."
    exit 1
fi

# Check for gradle wrapper
if [ ! -f "gradlew" ]; then
    echo "❌ Error: Gradle wrapper not found."
    exit 1
fi

# Make gradlew executable
chmod +x gradlew

# Clean previous builds
echo "🧹 Cleaning previous builds..."
./gradlew clean

# Build based on argument
BUILD_TYPE="${1:-release}"

if [ "$BUILD_TYPE" = "debug" ]; then
    echo "🔧 Building DEBUG APK..."
    ./gradlew assembleDebug
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
else
    echo "🚀 Building RELEASE APK..."
    
    # Check for keystore
    if [ ! -f "keystore.properties" ]; then
        echo "⚠️  Warning: keystore.properties not found. Building unsigned APK."
    fi
    
    ./gradlew assembleRelease
    
    # Determine output path
    if [ -f "app/build/outputs/apk/release/app-release.apk" ]; then
        APK_PATH="app/build/outputs/apk/release/app-release.apk"
    else
        APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
    fi
fi

# Check if build succeeded
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo "✅ Build successful!"
    echo "📦 APK: $APK_PATH ($APK_SIZE)"
    
    # Copy to public directory for serving
    mkdir -p "../public/downloads"
    cp "$APK_PATH" "../public/downloads/tetra-overflow-ultra-${BUILD_TYPE}.apk"
    echo "📁 Copied to: public/downloads/tetra-overflow-ultra-${BUILD_TYPE}.apk"
else
    echo "❌ Build failed. APK not found at expected path."
    exit 1
fi
