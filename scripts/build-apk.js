// Node.js script to build APK
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_TYPES = ['debug', 'release'];

function buildApk(buildType = 'release') {
  if (!BUILD_TYPES.includes(buildType)) {
    throw new Error(`Invalid build type: ${buildType}. Must be 'debug' or 'release'.`);
  }

  console.log(`🔨 Building ${buildType.toUpperCase()} APK...`);

  const androidDir = path.join(__dirname, '..', 'android');
  const isWindows = process.platform === 'win32';
  const gradlew = isWindows ? 'gradlew.bat' : './gradlew';

  // Check if android directory exists
  if (!fs.existsSync(androidDir)) {
    throw new Error('Android directory not found. Run from project root.');
  }

  // Note: Skipping Java check - Gradle wrapper will find Java automatically via JAVA_HOME or system defaults

  // Make gradlew executable on Unix
  if (!isWindows) {
    const gradlewPath = path.join(androidDir, 'gradlew');
    if (fs.existsSync(gradlewPath)) {
      fs.chmodSync(gradlewPath, '755');
    }
  }

  try {
    // Clean
    console.log('🧹 Cleaning previous builds...');
    execSync(`${gradlew} clean`, {
      cwd: androidDir,
      stdio: 'inherit'
    });

    // Build
    const assembleTask = buildType === 'debug' ? 'assembleDebug' : 'assembleRelease';
    console.log(`🚀 Running ${assembleTask}...`);
    execSync(`${gradlew} ${assembleTask}`, {
      cwd: androidDir,
      stdio: 'inherit'
    });

    // Find the APK
    const apkDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', buildType);
    const apkFiles = fs.readdirSync(apkDir).filter(f => f.endsWith('.apk'));
    
    if (apkFiles.length === 0) {
      throw new Error('APK file not found after build.');
    }

    const apkPath = path.join(apkDir, apkFiles[0]);
    const apkSize = (fs.statSync(apkPath).size / 1024 / 1024).toFixed(2);

    console.log(`✅ Build successful!`);
    console.log(`📦 APK: ${apkPath} (${apkSize} MB)`);

    // Copy to public/downloads
    const downloadsDir = path.join(__dirname, '..', 'public', 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const destPath = path.join(downloadsDir, `tetra-overflow-ultra-${buildType}.apk`);
    fs.copyFileSync(apkPath, destPath);
    console.log(`📁 Copied to: public/downloads/tetra-overflow-ultra-${buildType}.apk`);

    return {
      success: true,
      apkPath: destPath,
      size: apkSize,
      buildType
    };

  } catch (error) {
    console.error(`❌ Build failed:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// CLI usage - detect if this file is being run directly
const scriptPath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === scriptPath || 
                     process.argv[1].replace(/\\/g, '/') === scriptPath.replace(/\\/g, '/');

if (isMainModule) {
  const buildType = process.argv[2] || 'release';
  const result = buildApk(buildType);
  process.exit(result.success ? 0 : 1);
}

export { buildApk };
