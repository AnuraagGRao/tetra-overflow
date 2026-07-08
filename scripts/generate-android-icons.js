import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const iconSizes = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 }
];

const sourceSvg = join(projectRoot, 'public', 'icons', 'newicon.svg');
const resPath = join(projectRoot, 'android', 'app', 'src', 'main', 'res');

async function generateIcons() {
  console.log('🎨 Generating Android launcher icons from newicon.svg...');
  
  for (const { folder, size } of iconSizes) {
    const targetDir = join(resPath, folder);
    
    // Create directory if it doesn't exist
    mkdirSync(targetDir, { recursive: true });
    
    // Generate square icon
    await sharp(sourceSvg)
      .resize(size, size)
      .png()
      .toFile(join(targetDir, 'ic_launcher.png'));
    
    // Generate round icon (with circular mask)
    await sharp(sourceSvg)
      .resize(size, size)
      .composite([{
        input: Buffer.from(
          `<svg width="${size}" height="${size}">
            <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
          </svg>`
        ),
        blend: 'dest-in'
      }])
      .png()
      .toFile(join(targetDir, 'ic_launcher_round.png'));
    
    console.log(`✅ Created ${folder} icons (${size}x${size})`);
  }
  
  console.log('🎉 All launcher icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('❌ Error generating icons:', err);
  process.exit(1);
});
