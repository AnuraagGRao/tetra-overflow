# 📱 Android APK Packaging Guide

This project includes a complete **Trusted Web Activity (TWA)** setup to package your Tetra Overflow Ultra PWA as a native Android APK.

## 🚀 Quick Start

### Prerequisites

1. **Java Development Kit (JDK) 17 or higher**
   ```bash
   # Check Java version
   java -version
   ```
   - Download from: https://www.oracle.com/java/technologies/downloads/
   - Or use OpenJDK: https://adoptium.net/

2. **Node.js and npm** (already required for the web app)

3. **Android SDK** (optional, for testing on emulators)

### Initial Setup

1. **Download Gradle Wrapper JAR**
   ```bash
   cd android
   # Download the wrapper JAR
   curl -o gradle/wrapper/gradle-wrapper.jar https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar
   
   # Or if you have Gradle installed globally:
   gradle wrapper
   ```

2. **Generate App Icons**
   - Place your 512x512 app icon in `android/app/src/main/res/` directories
   - See `android/app/src/main/res/ICON_INSTRUCTIONS.md` for details
   - You can use online tools like https://romannurik.github.io/AndroidAssetStudio/

3. **Create a Keystore for Signing** (Production)
   ```bash
   cd android
   keytool -genkey -v -keystore release-key.keystore \
     -alias tetra-overflow \
     -keyalg RSA \
     -keysize 2048 \
     -validity 10000
   ```
   
   Create `android/keystore.properties`:
   ```properties
   storePassword=YOUR_STORE_PASSWORD
   keyPassword=YOUR_KEY_PASSWORD
   keyAlias=tetra-overflow
   storeFile=release-key.keystore
   ```
   
   ⚠️ **IMPORTANT**: Keep your keystore and passwords secure! Add them to `.gitignore`.

4. **Get SHA-256 Fingerprint**
   ```bash
   keytool -list -v -keystore release-key.keystore -alias tetra-overflow
   ```
   Look for the SHA-256 fingerprint in the output.

5. **Update Asset Links**
   - Edit `public/.well-known/assetlinks.json`
   - Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with your actual fingerprint
   - Format: `A1:B2:C3:D4:...` (colon-separated hex)

6. **Configure Your Domain**
   - Edit `android/app/build.gradle`
   - Update `hostName` to your deployed domain (e.g., `tetraoverflow.web.app`)
   - Update `defaultUrl` to your full app URL

## 🔨 Building APKs

### Method 1: NPM Scripts (Recommended)

```bash
# Build release APK
npm run build:apk

# Build debug APK
npm run build:apk:debug
```

The APK will be copied to `public/downloads/` for serving.

### Method 2: Platform Scripts

**Windows:**
```bash
scripts\build-apk.bat release
# or
scripts\build-apk.bat debug
```

**Unix/Mac:**
```bash
bash scripts/build-apk.sh release
# or
bash scripts/build-apk.sh debug
```

### Method 3: Direct Gradle

```bash
cd android

# Debug build
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Release build (requires keystore)
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

## 🌐 Build Server Setup

The project includes a Node.js server that can build APKs on-demand from the web app.

### 1. Install Server Dependencies

```bash
cd server
npm install
```

### 2. Configure Server

```bash
cp .env.example .env
# Edit .env and set BUILD_API_KEY to a secure random string
```

### 3. Start Server

```bash
# From root directory
npm run server

# Or for development with auto-reload
npm run server:dev

# Or from server directory
cd server
npm start
```

The server will run on `http://localhost:3001` by default.

### 4. Configure Web App

Create `.env` in the root directory:

```env
VITE_BUILD_SERVER_URL=http://localhost:3001
VITE_BUILD_API_KEY=your-secure-api-key-here
```

For production, update these to your deployed server URL.

### 5. Access Download Page

Navigate to `/download` in your web app to:
- View available APKs
- Trigger new builds
- Download APKs directly

## 📦 What's a TWA?

**Trusted Web Activity (TWA)** is a way to wrap your Progressive Web App in a native Android container:

- ✅ Appears as a native app in the app drawer
- ✅ Runs in full-screen without browser UI
- ✅ Has its own icon and splash screen
- ✅ Can be distributed outside Google Play Store
- ✅ Automatically updates when the web app updates
- ✅ Smaller than traditional native apps

### Requirements for TWA

1. **HTTPS**: Your web app must be served over HTTPS
2. **Digital Asset Links**: Valid `assetlinks.json` served at `/.well-known/assetlinks.json`
3. **PWA Requirements**: Valid service worker and manifest.json
4. **Matching SHA-256**: Fingerprint in assetlinks.json must match your release keystore

## 🔧 Troubleshooting

### Build Failures

**"Java not found"**
- Install JDK 17 or higher
- Add Java to your PATH

**"Gradle wrapper not found"**
- Download `gradle-wrapper.jar` (see Initial Setup above)

**"Keystore not found"**
- Generate a keystore or remove signing config for debug builds

### TWA Issues

**Shows browser UI instead of full-screen**
- Digital Asset Links not verified
- Check `assetlinks.json` is accessible at `https://your-domain.com/.well-known/assetlinks.json`
- Verify SHA-256 fingerprint matches your release keystore
- Use Google's testing tool: https://developers.google.com/digital-asset-links/tools/generator

**White screen on launch**
- Check `defaultUrl` in `android/app/build.gradle` matches your deployed app
- Verify the URL is accessible via HTTPS
- Check Chrome DevTools for errors

**Installation blocked**
- Enable "Install from Unknown Sources" in Android settings
- This is normal for sideloaded apps (not from Play Store)

### Server Issues

**"Cannot connect to build server"**
- Ensure the server is running
- Check `VITE_BUILD_SERVER_URL` in `.env`
- Check CORS configuration if accessing from a different domain

**"Build failed"**
- Check server logs for detailed error messages
- Ensure Java and Android SDK are available on the server
- Verify all required files are present in the `android/` directory

## 📱 Distribution

### Option 1: Direct Download (Current Setup)
- Users visit your website and download the APK
- Simple, no approval process
- Users need to enable "Unknown Sources"

### Option 2: Google Play Store (Future)
- Create a Google Play Developer account ($25 one-time fee)
- Upload signed APK/AAB
- Goes through review process
- Better discoverability and trust

### Option 3: Alternative App Stores
- Amazon Appstore
- Samsung Galaxy Store
- F-Droid (for open-source apps)

## 🔐 Security Notes

1. **Never commit your keystore or passwords** to version control
2. **Keep keystore.properties private** - add to `.gitignore`
3. **Use strong passwords** for keystore and keys
4. **Backup your keystore** - if lost, you can't update your app
5. **Use API keys** for the build server in production
6. **Enable CORS properly** if hosting the build server separately

## 📚 Additional Resources

- [Android TWA Documentation](https://developer.chrome.com/docs/android/trusted-web-activity/)
- [Digital Asset Links](https://developers.google.com/digital-asset-links)
- [PWABuilder](https://www.pwabuilder.com/) - Alternative APK generation
- [Android Signing Guide](https://developer.android.com/studio/publish/app-signing)

## 🎯 Next Steps

1. ✅ Complete initial setup (keystore, icons, asset links)
2. 🔨 Build and test a debug APK on a device
3. 🚀 Build and test a release APK
4. 🌐 Deploy web app and verify asset links
5. 📱 Distribute APK via your website
6. 🏪 (Optional) Publish to Google Play Store

---

**Need help?** Check the troubleshooting section or open an issue on the repository.
