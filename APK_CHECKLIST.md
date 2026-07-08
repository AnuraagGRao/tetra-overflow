# 📋 APK Build Checklist

Use this checklist to track your progress setting up the APK build system.

---

## 🔧 Prerequisites

- [ ] Java JDK 17 or higher installed
  ```bash
  java -version
  ```
- [ ] Node.js and npm installed (already required for web app)
- [ ] Git (for version control)
- [ ] Text editor (VS Code recommended)

---

## 📦 Initial Setup

### Gradle Wrapper
- [ ] Navigate to `android/` directory
- [ ] Download `gradle-wrapper.jar`
  ```bash
  curl -o gradle/wrapper/gradle-wrapper.jar https://raw.githubusercontent.com/gradle/gradle/master/gradle/wrapper/gradle-wrapper.jar
  ```
- [ ] Make gradlew executable (Unix/Mac)
  ```bash
  chmod +x gradlew
  ```

### App Icons
- [ ] Visit https://romannurik.github.io/AndroidAssetStudio/
- [ ] Upload your 512x512 icon
- [ ] Download generated icon pack
- [ ] Extract to `android/app/src/main/res/`
- [ ] Verify icons in all mipmap folders (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)

---

## 🔐 Signing Configuration

### Generate Keystore
- [ ] Run keytool to create keystore
  ```bash
  cd android
  keytool -genkey -v -keystore release-key.keystore -alias tetra-overflow -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] Save your passwords in a secure location (password manager)
- [ ] Backup keystore file to secure location

### Create keystore.properties
- [ ] Create file: `android/keystore.properties`
- [ ] Add configuration:
  ```properties
  storePassword=YOUR_STORE_PASSWORD
  keyPassword=YOUR_KEY_PASSWORD
  keyAlias=tetra-overflow
  storeFile=release-key.keystore
  ```
- [ ] Verify file is in `.gitignore`

### Get SHA-256 Fingerprint
- [ ] Run keytool to get fingerprint
  ```bash
  keytool -list -v -keystore release-key.keystore -alias tetra-overflow
  ```
- [ ] Copy SHA-256 fingerprint (format: `A1:B2:C3:...`)
- [ ] Save fingerprint for next step

---

## 🌐 Domain Configuration

### Update Asset Links
- [ ] Open `public/.well-known/assetlinks.json`
- [ ] Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with your actual fingerprint
- [ ] Save file

### Configure Build
- [ ] Open `android/app/build.gradle`
- [ ] Update `hostName` to your deployed domain
- [ ] Update `defaultUrl` to your full app URL
- [ ] Save file

---

## 🔨 Build & Test

### Debug Build (Testing)
- [ ] Run debug build command
  ```bash
  npm run build:apk:debug
  ```
- [ ] Verify APK created: `public/downloads/tetra-overflow-ultra-debug.apk`
- [ ] Transfer APK to Android device
- [ ] Install and test
- [ ] Verify app launches (may show browser UI - that's OK for debug)

### Release Build (Production)
- [ ] Run release build command
  ```bash
  npm run build:apk
  ```
- [ ] Verify APK created: `public/downloads/tetra-overflow-ultra-release.apk`
- [ ] Check APK is signed (not "unsigned" in filename)
- [ ] Note the APK size for reference

---

## 🚀 Deployment

### Deploy Web App
- [ ] Build web app: `npm run build`
- [ ] Deploy to hosting (Firebase, Netlify, etc.)
- [ ] Verify app accessible via HTTPS
- [ ] Test on mobile browser

### Verify Asset Links
- [ ] Confirm assetlinks.json accessible at:
  ```
  https://your-domain.com/.well-known/assetlinks.json
  ```
- [ ] Test with Google's validator:
  https://developers.google.com/digital-asset-links/tools/generator
- [ ] Verify validation passes

### Test Release APK
- [ ] Install release APK on device
- [ ] Launch app
- [ ] Verify TWA features:
  - [ ] Opens in full-screen
  - [ ] No browser UI visible
  - [ ] Uses your app icon
  - [ ] Shows splash screen
  - [ ] Status bar themed correctly

---

## 🌐 Build Server Setup (Optional)

### Install Dependencies
- [ ] Navigate to `server/` directory
- [ ] Run `npm install`
- [ ] Verify no errors

### Configure Server
- [ ] Copy `.env.example` to `.env`
- [ ] Generate secure API key
- [ ] Update `BUILD_API_KEY` in `server/.env`

### Configure Web App
- [ ] Copy `.env.example` to `.env` (root directory)
- [ ] Update `VITE_BUILD_SERVER_URL`
- [ ] Update `VITE_BUILD_API_KEY` (match server)

### Test Server
- [ ] Start server: `npm run server:dev`
- [ ] Test health endpoint:
  ```bash
  curl http://localhost:3001/api/health
  ```
- [ ] Start web app: `npm run dev`
- [ ] Visit `/download` route
- [ ] Test "Build APK" buttons
- [ ] Verify build starts and completes
- [ ] Download generated APK

---

## 📱 Distribution

### Website Distribution
- [ ] Add download link to main menu
- [ ] Create download page content
- [ ] Test download flow
- [ ] Add installation instructions
- [ ] Test on different devices

### Google Play Store (Future)
- [ ] Create Play Developer account
- [ ] Prepare store listing assets
  - [ ] App icon (512x512)
  - [ ] Feature graphic (1024x500)
  - [ ] Screenshots (phone & tablet)
  - [ ] Description and title
- [ ] Generate AAB (Android App Bundle)
  ```bash
  cd android
  ./gradlew bundleRelease
  ```
- [ ] Upload to Play Console
- [ ] Complete content rating questionnaire
- [ ] Submit for review
- [ ] Monitor review status

---

## 🔐 Security

### Protect Sensitive Files
- [ ] Verify `.gitignore` includes:
  - [ ] `*.keystore`
  - [ ] `keystore.properties`
  - [ ] `.env` files
  - [ ] `*.apk` files
- [ ] Never commit passwords or keys
- [ ] Store keystore backup securely (encrypted cloud storage)

### Secure Build Server
- [ ] Use strong API keys (32+ random characters)
- [ ] Enable HTTPS in production
- [ ] Configure CORS appropriately
- [ ] Consider rate limiting
- [ ] Monitor server logs
- [ ] Keep dependencies updated

---

## 📊 Maintenance

### Regular Tasks
- [ ] Update app when web version changes
- [ ] Rebuild APK for significant updates
- [ ] Test on various Android versions
- [ ] Monitor user feedback
- [ ] Keep signing certificate valid

### Version Updates
- [ ] Update `versionCode` in `android/app/build.gradle`
- [ ] Update `versionName` in `android/app/build.gradle`
- [ ] Document changes in release notes
- [ ] Rebuild and redistribute

---

## ✅ Final Verification

Before distributing to users:

- [ ] APK installs without errors
- [ ] App launches successfully
- [ ] TWA verification passes (no browser UI)
- [ ] All game features work
- [ ] Sound/music plays correctly
- [ ] Touch controls responsive
- [ ] No crashes or errors
- [ ] Performance acceptable
- [ ] Asset links verified
- [ ] Download page functional
- [ ] Installation instructions clear

---

## 🎉 Success!

Once all checkboxes are checked, you're ready to distribute your APK!

**Last steps:**
1. Share download link with testers
2. Gather feedback
3. Make improvements
4. Consider Play Store submission
5. Celebrate! 🎊

---

**Need help with any step?**

- See `QUICK_START_APK.md` for quick guidance
- See `APK_SETUP.md` for detailed instructions
- See `APK_SUMMARY.md` for overview of what was created
- Check specific README files in each directory

**Still stuck?** Open an issue on the repository with:
- What step you're on
- What error you're seeing
- What you've tried
- Your OS and Java version
