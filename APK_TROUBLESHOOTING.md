# 🔧 APK Build Troubleshooting Guide

Common issues and their solutions when building Android APKs.

---

## Java Issues

### "java: command not found"

**Problem:** Java is not installed or not in PATH.

**Solutions:**

**Windows:**
```bash
# Install from https://adoptium.net/
# Then add to PATH:
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.0.X"
setx PATH "%PATH%;%JAVA_HOME%\bin"
```

**Mac:**
```bash
# Install via Homebrew
brew install openjdk@17

# Add to PATH (add to ~/.zshrc or ~/.bash_profile)
export JAVA_HOME=$(/usr/libexec/java_home)
export PATH=$JAVA_HOME/bin:$PATH
```

**Linux:**
```bash
sudo apt update
sudo apt install openjdk-17-jdk

# Verify
java -version
```

### Wrong Java Version

**Problem:** Build requires Java 17+, but older version installed.

**Check version:**
```bash
java -version
```

**Solution:** Install Java 17 or higher and set as default:

**Mac:**
```bash
# List installed versions
/usr/libexec/java_home -V

# Set default
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

**Linux:**
```bash
# List installed versions
update-alternatives --list java

# Set default
sudo update-alternatives --config java
```

---

## Gradle Issues

### "gradle-wrapper.jar not found"

**Problem:** Missing Gradle wrapper JAR file.

**Solution:**
```bash
cd android
curl -o gradle/wrapper/gradle-wrapper.jar https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar

# Or if you have Gradle installed globally:
gradle wrapper
```

### "Permission denied: gradlew"

**Problem:** Gradle wrapper not executable (Unix/Mac).

**Solution:**
```bash
cd android
chmod +x gradlew
```

### Gradle daemon fails to start

**Problem:** Insufficient memory or port conflicts.

**Solution:**
```bash
# Stop all Gradle daemons
cd android
./gradlew --stop

# Increase memory (edit android/gradle.properties)
org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8

# Try build again
./gradlew clean assembleDebug
```

---

## Build Failures

### "Keystore not found"

**Problem:** Release build can't find signing keystore.

**Solutions:**

1. **Create keystore:**
```bash
cd android
keytool -genkey -v -keystore release-key.keystore \
  -alias tetra-overflow \
  -keyalg RSA -keysize 2048 -validity 10000
```

2. **Create keystore.properties:**
```properties
storePassword=YOUR_PASSWORD
keyPassword=YOUR_PASSWORD
keyAlias=tetra-overflow
storeFile=release-key.keystore
```

3. **Or build debug instead:**
```bash
npm run build:apk:debug
```

### "Incorrect keystore password"

**Problem:** Wrong password in keystore.properties.

**Solution:**
- Double-check passwords
- Ensure no extra spaces in keystore.properties
- Try resetting keystore password:
```bash
keytool -storepasswd -keystore release-key.keystore
```

### Build succeeds but APK not found

**Problem:** APK generated in unexpected location.

**Solution:**
```bash
# Search for APK
cd android
find . -name "*.apk"

# Common locations:
# Debug: app/build/outputs/apk/debug/app-debug.apk
# Release: app/build/outputs/apk/release/app-release.apk
# Release unsigned: app/build/outputs/apk/release/app-release-unsigned.apk
```

### "AAPT: error: resource android:attr/lStar not found"

**Problem:** SDK version mismatch.

**Solution:**
```bash
# Update SDK in android/app/build.gradle
compileSdk 34  # or higher
targetSdk 34
```

---

## TWA Issues (Browser UI Shows)

### App shows browser toolbar

**Problem:** Digital Asset Links not verified.

**Root Causes:**
1. assetlinks.json not accessible
2. Wrong SHA-256 fingerprint
3. Domain mismatch

**Solutions:**

1. **Check assetlinks.json is accessible:**
```bash
curl https://your-domain.com/.well-known/assetlinks.json
```

Should return JSON, not 404.

2. **Verify SHA-256 fingerprint:**
```bash
cd android
keytool -list -v -keystore release-key.keystore -alias tetra-overflow
```

Copy the SHA-256 (format: `A1:B2:C3:...`) and paste into `public/.well-known/assetlinks.json`.

3. **Check domain matches:**
- `hostName` in `android/app/build.gradle`
- Must match deployed domain exactly
- No trailing slashes

4. **Test with Google's validator:**
- Visit: https://developers.google.com/digital-asset-links/tools/generator
- Enter your package name: `com.tetraoverflow.ultra`
- Enter your domain
- Should show green checkmark

5. **Clear app data and reinstall:**
```bash
# Uninstall old version
adb uninstall com.tetraoverflow.ultra

# Install new version
adb install app-release.apk
```

### White screen on launch

**Problem:** Wrong URL or app not accessible.

**Solutions:**

1. **Check defaultUrl in build.gradle:**
```gradle
defaultUrl: "https://your-domain.com/tetra-overflow/"
```

2. **Verify URL is accessible:**
```bash
curl https://your-domain.com/tetra-overflow/
```

3. **Check Chrome DevTools:**
```bash
# Enable USB debugging
# Connect device
# Chrome DevTools → Remote devices
# Inspect your app
```

4. **Check service worker:**
- Service worker might be caching old content
- Clear app data or unregister SW

---

## Installation Issues

### "App not installed"

**Problem:** Various causes.

**Solutions:**

1. **Insufficient storage:**
- Free up space on device
- Clear cache

2. **Conflicting app:**
```bash
# Uninstall existing version
adb uninstall com.tetraoverflow.ultra
```

3. **Corrupt APK:**
- Re-download APK
- Rebuild from source

4. **Architecture mismatch:**
- Make sure APK supports device architecture
- Check `android/app/build.gradle` for `splits` configuration

### "Package appears to be corrupt"

**Problem:** APK download was interrupted or corrupted.

**Solutions:**
- Re-download APK
- Verify APK integrity:
```bash
unzip -t app-release.apk
```
- Use different transfer method (USB vs cloud)

### "Unknown sources" blocked

**Problem:** Android security settings.

**Solution:**
1. Go to Settings → Security
2. Enable "Unknown Sources" or "Install Unknown Apps"
3. Allow installation from browser/file manager
4. Try installation again

---

## Server Issues

### Cannot connect to build server

**Problem:** Server not running or wrong URL.

**Solutions:**

1. **Check server is running:**
```bash
npm run server:dev
```

2. **Test server directly:**
```bash
curl http://localhost:3001/api/health
```

3. **Check .env configuration:**
```env
# Root .env
VITE_BUILD_SERVER_URL=http://localhost:3001

# server/.env
PORT=3001
```

4. **Check CORS:**
- If accessing from different domain
- Update CORS settings in `server/index.js`

### Build starts but never completes

**Problem:** Build process hanging or crashing.

**Solutions:**

1. **Check server logs:**
- Look for error messages
- Check Java/Gradle output

2. **Increase timeout:**
- Edit `server/index.js`
- Increase execution timeout

3. **Run build manually:**
```bash
npm run build:apk
```
See if error messages provide more detail.

4. **Check disk space:**
- Gradle builds need temporary space
- Free up at least 1GB

---

## Icon Issues

### Default/placeholder icons showing

**Problem:** Custom icons not generated.

**Solution:**
1. Generate icons using Android Asset Studio
2. Place in correct mipmap folders
3. Check all densities present:
   - mipmap-mdpi (48x48)
   - mipmap-hdpi (72x72)
   - mipmap-xhdpi (96x96)
   - mipmap-xxhdpi (144x144)
   - mipmap-xxxhdpi (192x192)
4. Rebuild APK

---

## Performance Issues

### App is slow or laggy

**Solutions:**

1. **Build release version:**
```bash
npm run build:apk  # Not debug
```

2. **Enable ProGuard optimization:**
Already enabled in release builds, but verify in `android/app/build.gradle`:
```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
    }
}
```

3. **Test on real device:**
- Emulators are often slower
- Test on target device hardware

---

## Debugging Tips

### Enable verbose logging

**Gradle:**
```bash
cd android
./gradlew assembleDebug --info
# or
./gradlew assembleDebug --debug
```

**ADB logs:**
```bash
adb logcat | grep -i "tetra"
```

### Check APK contents

```bash
unzip -l app-release.apk
```

### Inspect app info

```bash
aapt dump badging app-release.apk
```

---

## Getting Help

If you're still stuck:

1. **Check existing documentation:**
   - [QUICK_START_APK.md](QUICK_START_APK.md)
   - [APK_SETUP.md](APK_SETUP.md)
   - [android/README.md](android/README.md)

2. **Search for error messages:**
   - Google the exact error
   - Check Stack Overflow
   - Android developer forums

3. **Create an issue:**
   - Repository issues page
   - Include:
     - Error message (full text)
     - Commands you ran
     - Your OS and versions
     - What you've tried
     - Relevant log output

4. **Useful commands for bug reports:**
```bash
# System info
java -version
node --version
npm --version

# Gradle version
cd android
./gradlew --version

# Android SDK (if installed)
sdkmanager --list

# APK info
aapt dump badging app-release.apk
```

---

## Prevention

### Best practices to avoid issues:

- ✅ Keep Java up to date
- ✅ Commit gradle-wrapper.jar to git
- ✅ Backup your keystore securely
- ✅ Test debug builds before release
- ✅ Document your passwords (securely)
- ✅ Keep dependencies updated
- ✅ Test on multiple devices
- ✅ Monitor build logs
- ✅ Version control everything except secrets

---

**Still having issues?** Check the specific README files for each component:
- Android: `android/README.md`
- Server: `server/README.md`
- Asset Links: `public/.well-known/README.md`
