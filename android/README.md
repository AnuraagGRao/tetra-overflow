# Android TWA Setup Instructions

## Prerequisites

1. **Java Development Kit (JDK) 17+**
   ```bash
   # Check Java version
   java -version
   ```

2. **Android SDK** (optional, but recommended for testing)
   - Download Android Studio or just the command-line tools
   - Set `ANDROID_HOME` environment variable

3. **Gradle Wrapper JAR**
   The `gradle-wrapper.jar` file is missing. Download it:
   ```bash
   cd android
   # If you have gradle installed globally:
   gradle wrapper
   
   # Or download directly:
   curl -o gradle/wrapper/gradle-wrapper.jar https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar
   ```

## Building the APK

### 1. Generate Launcher Icons
Place your app icons in the appropriate `mipmap` directories. See `app/src/main/res/ICON_INSTRUCTIONS.md` for details.

### 2. Configure Your Domain
Edit `android/app/build.gradle` and update:
- `hostName` - Your deployed domain
- `defaultUrl` - Full URL to your app
- Asset links JSON

### 3. Build Debug APK
```bash
cd android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

### 4. Build Release APK
```bash
cd android
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### 5. Sign the Release APK

Generate a keystore (first time only):
```bash
keytool -genkey -v -keystore release-key.keystore -alias tetra-overflow -keyalg RSA -keysize 2048 -validity 10000
```

Create `android/keystore.properties`:
```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=tetra-overflow
storeFile=release-key.keystore
```

Update `android/app/build.gradle` to add signing config (see commented section).

Then build:
```bash
./gradlew assembleRelease
```

## Digital Asset Links

For TWA to work properly, you must serve an `assetlinks.json` file at:
```
https://your-domain.com/.well-known/assetlinks.json
```

Generate your SHA-256 fingerprint:
```bash
keytool -list -v -keystore release-key.keystore -alias tetra-overflow
```

See `public/.well-known/assetlinks.json` in this project.

## Testing

1. Install the APK on an Android device
2. Open the app
3. It should load your PWA in full-screen mode without browser UI
4. Verify Digital Asset Links verification in Chrome DevTools

## Troubleshooting

- **White screen**: Check that the URL in `build.gradle` matches your deployed app
- **Shows browser UI**: Asset Links not verified - check `assetlinks.json` and SHA-256 fingerprint
- **Build fails**: Ensure Java 17+ and proper Gradle wrapper setup
