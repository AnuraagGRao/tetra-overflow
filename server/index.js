import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve APK files
app.use('/downloads', express.static(path.join(__dirname, '..', 'public', 'downloads')));

// Build status tracking
let currentBuild = {
  inProgress: false,
  type: null,
  startTime: null,
  log: []
};

// Build APK endpoint
app.post('/api/build-apk', async (req, res) => {
  const { buildType = 'release', apiKey } = req.body;

  // Basic API key check (set BUILD_API_KEY in .env)
  if (process.env.BUILD_API_KEY && apiKey !== process.env.BUILD_API_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (currentBuild.inProgress) {
    return res.status(409).json({ 
      error: 'Build already in progress',
      buildType: currentBuild.type,
      startTime: currentBuild.startTime
    });
  }

  if (!['debug', 'release'].includes(buildType)) {
    return res.status(400).json({ error: 'Invalid build type. Must be "debug" or "release".' });
  }

  // Start build in background
  currentBuild = {
    inProgress: true,
    type: buildType,
    startTime: new Date().toISOString(),
    log: [`Started ${buildType} build at ${new Date().toLocaleString()}`]
  };

  res.json({ 
    message: 'Build started',
    buildType,
    checkStatusAt: '/api/build-status'
  });

  // Execute build asynchronously
  try {
    const buildScriptPath = path.join(__dirname, '..', 'scripts', 'build-apk.js');
    const { buildApk } = await import(`file://${buildScriptPath}`);
    
    const result = await buildApk(buildType);
    
    currentBuild.log.push(`Build ${result.success ? 'succeeded' : 'failed'}`);
    if (result.success) {
      currentBuild.log.push(`APK size: ${result.size} MB`);
      currentBuild.downloadUrl = `/downloads/tetra-overflow-ultra-${buildType}.apk`;
    } else {
      currentBuild.error = result.error;
    }
    
    currentBuild.inProgress = false;
    currentBuild.success = result.success;
    currentBuild.endTime = new Date().toISOString();
    
  } catch (error) {
    currentBuild.log.push(`Build error: ${error.message}`);
    currentBuild.inProgress = false;
    currentBuild.success = false;
    currentBuild.error = error.message;
    currentBuild.endTime = new Date().toISOString();
  }
});

// Check build status
app.get('/api/build-status', (req, res) => {
  res.json(currentBuild);
});

// List available APKs
app.get('/api/apks', (req, res) => {
  const downloadsDir = path.join(__dirname, '..', 'public', 'downloads');
  
  if (!fs.existsSync(downloadsDir)) {
    return res.json({ apks: [] });
  }

  const files = fs.readdirSync(downloadsDir)
    .filter(f => f.endsWith('.apk'))
    .map(filename => {
      const filePath = path.join(downloadsDir, filename);
      const stats = fs.statSync(filePath);
      
      return {
        filename,
        downloadUrl: `/downloads/${filename}`,
        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
        modified: stats.mtime,
        buildType: filename.includes('debug') ? 'debug' : 'release'
      };
    })
    .sort((a, b) => b.modified - a.modified);

  res.json({ apks: files });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    server: 'Tetra Overflow Build Server',
    version: '1.0.0'
  });
});

// Clear build history
app.post('/api/clear-builds', (req, res) => {
  const { apiKey } = req.body;
  
  if (process.env.BUILD_API_KEY && apiKey !== process.env.BUILD_API_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  currentBuild = {
    inProgress: false,
    type: null,
    startTime: null,
    log: []
  };

  res.json({ message: 'Build history cleared' });
});

app.listen(PORT, () => {
  console.log(`🚀 Tetra Overflow Build Server running on port ${PORT}`);
  console.log(`📦 APK downloads: http://localhost:${PORT}/downloads/`);
  console.log(`🔍 Build status: http://localhost:${PORT}/api/build-status`);
});
