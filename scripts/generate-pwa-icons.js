import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const iconSizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 }
];

const sourceSvg = join(projectRoot, 'public', 'icons', 'newicon.svg');
const outputDir = join(projectRoot, 'public', 'icons');

async function generatePWAIcons() {
  console.log('🎨 Generating PWA PNG icons from newicon.svg...');
  
  for (const { name, size } of iconSizes) {
    await sharp(sourceSvg)
      .resize(size, size, { fit: 'contain', background: { r: 5, g: 6, b: 13, alpha: 1 } })
      .png()
      .toFile(join(outputDir, name));
    
    console.log(`✅ Created ${name} (${size}x${size})`);
  }
  
  console.log('🎉 All PWA icons generated successfully!');
}

generatePWAIcons().catch(err => {
  console.error('❌ Error generating PWA icons:', err);
  process.exit(1);
});
