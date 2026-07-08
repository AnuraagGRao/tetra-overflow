# Tetra Overflow Build Server

A simple Node.js server for building and serving Android APKs for the Tetra Overflow Ultra PWA.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env and set a secure BUILD_API_KEY
```

3. Start the server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

## API Endpoints

### `POST /api/build-apk`
Trigger a new APK build.

**Body:**
```json
{
  "buildType": "release",  // or "debug"
  "apiKey": "your-api-key"
}
```

**Response:**
```json
{
  "message": "Build started",
  "buildType": "release",
  "checkStatusAt": "/api/build-status"
}
```

### `GET /api/build-status`
Check the current build status.

**Response:**
```json
{
  "inProgress": false,
  "type": "release",
  "success": true,
  "startTime": "2026-06-30T12:00:00.000Z",
  "endTime": "2026-06-30T12:05:00.000Z",
  "downloadUrl": "/downloads/tetra-overflow-ultra-release.apk",
  "log": ["Started release build...", "Build succeeded", "APK size: 5.2 MB"]
}
```

### `GET /api/apks`
List all available APK files.

**Response:**
```json
{
  "apks": [
    {
      "filename": "tetra-overflow-ultra-release.apk",
      "downloadUrl": "/downloads/tetra-overflow-ultra-release.apk",
      "size": "5.2 MB",
      "modified": "2026-06-30T12:05:00.000Z",
      "buildType": "release"
    }
  ]
}
```

### `GET /downloads/:filename`
Download an APK file.

### `POST /api/clear-builds`
Clear build history (requires API key).

## Security

- Set a strong `BUILD_API_KEY` in production
- Use HTTPS in production
- Consider rate limiting for the build endpoint
- Restrict access using firewall rules if needed

## Integration with Firebase Hosting

To use with Firebase Hosting, configure rewrites in `firebase.json`:

```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "/api/**",
        "function": "buildServer"
      }
    ]
  }
}
```

Or deploy as a separate service on Cloud Run, Heroku, etc.
