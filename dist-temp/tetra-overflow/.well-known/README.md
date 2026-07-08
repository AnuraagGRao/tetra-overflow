# Digital Asset Links for TWA

This directory contains the `assetlinks.json` file required for Trusted Web Activities (TWA) to work properly.

## What is Digital Asset Links?

Digital Asset Links is a protocol that allows apps to verify their ownership of a domain. For TWAs to work without showing browser UI, Android needs to verify that your APK has permission to handle URLs for your domain.

## Setup Instructions

1. **Get your SHA-256 fingerprint** from your release keystore:
   ```bash
   cd android
   keytool -list -v -keystore release-key.keystore -alias tetra-overflow
   ```

2. **Update `assetlinks.json`** with your SHA-256 fingerprint (replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT`).

3. **Deploy to your domain** so the file is accessible at:
   ```
   https://your-domain.com/.well-known/assetlinks.json
   ```

4. **Verify the link** using Google's testing tool:
   ```
   https://developers.google.com/digital-asset-links/tools/generator
   ```

## Example

If your SHA-256 fingerprint is `A1:B2:C3:...`, your assetlinks.json should look like:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.tetraoverflow.ultra",
    "sha256_cert_fingerprints": [
      "A1:B2:C3:D4:E5:F6:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34"
    ]
  }
}]
```

## Firebase Hosting Configuration

If you're using Firebase Hosting, make sure the file is accessible. Firebase Hosting should serve files from the `public` directory by default, but you may need to add a rewrite rule in `firebase.json` if needed:

```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "/.well-known/**",
        "destination": "/.well-known/:path"
      }
    ]
  }
}
```

## Troubleshooting

- **File not accessible**: Check that your hosting provider serves files from `.well-known` directories
- **Wrong fingerprint**: Verify you're using the SHA-256 fingerprint from your **release** keystore, not debug
- **Verification fails**: Use Google's Digital Asset Links testing tool to debug
- **Browser UI still shows**: Clear app data and reinstall the APK after fixing the assetlinks.json file
