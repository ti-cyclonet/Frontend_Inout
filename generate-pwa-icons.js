const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE = path.resolve(__dirname, 'src/assets/img/logo_inout_v7.png');
const OUTPUT_DIR = path.resolve(__dirname, 'src/assets/icons/pwa');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generate() {
  for (const size of SIZES) {
    const output = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(output);
    console.log(`Generated: icon-${size}x${size}.png`);
  }
  console.log('Done! All PWA icons generated.');
}

generate().catch(console.error);
