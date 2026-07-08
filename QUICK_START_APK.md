# 🎯 APK Build System - Quick Start Guide

This 5-minute guide gets you building Android APKs fast!

## ⚡ Super Quick Start (Debug Build)

If you just want to test an APK quickly without certificates:

```bash
# 1. Download Gradle wrapper (one-time)
cd android
curl -o gradle/wrapper/gradle-wrapper.jar https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar
cd ..

# 2. Build debug APK (no signing needed)
npm run build:apk:debug

# 3. Find your APK
# Location: public/downloads/tetra-overflow-ultra-debug.apk
```

That's it! Install it on your Android device to test.

⚠️ **Note:** Debug builds are for testing only. For production, follow the full setup below.

---

## 🚀 Production Setup (15 minutes)

### Step 1: Prerequisites

Install Java JDK 17+:
- **Windows:** Download from https://adoptium.net/
- **Mac:** `brew install openjdk@17`
- **Linux:** `sudo apt install openjdk-17-jdk`

Verify:
```bash
java -version  # Should show 17 or higher
```

### Step 2: Gradle Wrapper

```bash
cd android
curl -o gradle/wrapper/gradle-wrapper.jar https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar

# Make executable (Unix/Mac)
chmod +x gradlew
```

### Step 3: App Icons

Generate launcher icons for your app:

1. Visit https://romannurik.github.io/AndroidAssetStudio/
2. Upload your 512x512 icon from `public/icons/icon-512x512.png`
3. Download the generated icon pack
4. Extract to `android/app/src/main/res/` (overwriting placeholder folders)

### Step 4: Create Signing Key

```bash
cd android
keytool -genkey -v -keystore release-key.keystore \
  -alias tetra-overflow \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Important:** Remember your passwords! You'll need them forever.

Create `android/keystore.properties`:
```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=tetra-overflow
storeFile=release-key.keystore
```

### Step 5: Get SHA-256 Fingerprint

```bash
cd android
keytool -list -v -keystore release-key.keystore -alias tetra-overflow
```

Copy the SHA-256 fingerprint (format: `A1:B2:C3:...`)

### Step 6: Update Asset Links

Edit `public/.well-known/assetlinks.json`:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.tetraoverflow.ultra",
    "sha256_cert_fingerprints": [
      "PASTE_YOUR_SHA256_HERE"
    ]
  }
}]
```

### Step 7: Configure Domain

Edit `android/app/build.gradle` (around line 15):
```gradle
manifestPlaceholders = [
    hostName: "your-domain.com",  // ← Change this
    defaultUrl: "https://your-domain.com/tetra-overflow/",  // ← And this
    // ... rest stays the same
]
```

### Step 8: Build Release APK

```bash
npm run build:apk
```

Find your signed APK at:
```
public/downloads/tetra-overflow-ultra-release.apk
```

---

## 🌐 Optional: Build Server (10 minutes)

Enable on-demand APK builds from your web app!

### 1. Install Server Dependencies

```bash
cd server
npm install
cd ..
```

### 2. Configure Server

```bash
# Copy example env file
cp server/.env.example server/.env

# Edit server/.env and set a secure API key:
# BUILD_API_KEY=your-random-secure-key-here
```

### 3. Configure Web App

```bash
# Copy example env file
cp .env.example .env

# Edit .env and set:
# VITE_BUILD_SERVER_URL=http://localhost:3001
# VITE_BUILD_API_KEY=same-key-as-server
```

### 4. Start Server

```bash
npm run server:dev
```

### 5. Test Download Page

Start your web app:
```bash
npm run dev
```

Visit: http://localhost:5173/tetra-overflow/download

You should see the download page with build buttons!

---

## 📱 Testing Your APK

### On Physical Device

1. **Enable Developer Mode:**
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back → Developer Options → Enable "USB Debugging"

2. **Transfer APK:**
   - Email it to yourself
   - Use USB cable and file transfer
   - Upload to cloud storage
   - Or use `adb install app-release.apk`

3. **Install:**
   - Open the APK file
   - Allow "Install from Unknown Sources" when prompted
   - Tap "Install"

4. **Launch:**
   - Find "Tetra Overflow Ultra" in your app drawer
   - It should launch in full-screen (no browser UI)

### Verify TWA Works

✅ **Good signs:**
- Opens in full-screen
- No browser UI visible
- Uses your app icon
- Shows splash screen

❌ **Bad signs (needs fixing):**
- Shows browser toolbar
- Displays "Chrome" branding
- → Check your assetlinks.json is deployed and fingerprint matches

---

## 🐛 Troubleshooting

### "Java not found"
```bash
# Add Java to PATH (Windows)
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.0.X"

# Add Java to PATH (Mac/Linux)
export JAVA_HOME=$(/usr/libexec/java_home)
```

### Build fails with "Keystore not found"
- Make sure `keystore.properties` exists in `android/` folder
- Check that `release-key.keystore` path is correct
- For testing, use debug build instead: `npm run build:apk:debug`

### APK shows browser UI
1. Deploy your web app first
2. Make sure `assetlinks.json` is accessible at:
   ```
   https://your-domain.com/.well-known/assetlinks.json
   ```
3. Verify fingerprint matches:
   ```bash
   keytool -list -v -keystore android/release-key.keystore
   ```
4. Test asset links:
   - Visit: https://developers.google.com/digital-asset-links/tools/generator
   - Enter your domain and package name
   - Verify it validates

### "Cannot connect to build server"
- Check server is running: `npm run server`
- Check `.env` has correct `VITE_BUILD_SERVER_URL`
- Try: `curl http://localhost:3001/api/health`

---

## 📦 Distribution

### Your Website (Easiest)

1. Build your web app: `npm run build`
2. Deploy to Firebase Hosting
3. Users visit `/download` route
4. Click "Download APK"
5. Done!

### Google Play Store (Future)

Once you're happy with your app:

1. Create Play Developer account ($25)
2. Upload signed APK/AAB
3. Fill out store listing
4. Submit for review
5. Get published!

---

## ✅ Final Checklist

- [ ] Java 17+ installed
- [ ] gradle-wrapper.jar downloaded
- [ ] App icons generated
- [ ] Keystore created
- [ ] SHA-256 fingerprint obtained
- [ ] assetlinks.json updated
- [ ] Domain configured in build.gradle
- [ ] Debug APK built and tested
- [ ] Release APK built and tested
- [ ] APK installed on device
- [ ] TWA verification working (no browser UI)
- [ ] Web app deployed
- [ ] Download page accessible
- [ ] (Optional) Build server running

---

## 🎉 You're Done!

Your Tetra Overflow Ultra PWA is now packaged as a native Android app!

**What's next?**

1. **Add to main menu:** Create a button linking to `/download`
2. **Promote:** Share the download link
3. **Monitor:** Check user feedback
4. **Update:** Rebuild APK when you update the web app
5. **Publish:** Consider Google Play Store distribution

For detailed documentation, see:
- **Full setup guide:** `APK_SETUP.md`
- **What was created:** `APK_SUMMARY.md`
- **Android details:** `android/README.md`
- **Server API:** `server/README.md`

Need help? Open an issue on the repository! 🚀
