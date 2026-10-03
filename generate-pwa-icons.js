const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Íconos de la app instalada (PWA). Se generan desde un ícono MAESTRO
 * cuadrado de 1024 px con fondo de color hasta el borde y el símbolo dentro
 * de la zona segura (círculo central del 80 %): Android recorta los íconos
 * "maskable" con su forma, y un logo a todo el ancho quedaba cortado.
 * Para cambiar el ícono, reemplaza icon-master.png y ejecuta este script.
 */
const SOURCE = path.resolve(__dirname, 'src/assets/icons/pwa/icon-master.png');
const OUTPUT_DIR = path.resolve(__dirname, 'src/assets/icons/pwa');
const SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512];

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generate() {
  for (const size of SIZES) {
    const output = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
    await sharp(SOURCE).resize(size, size).png().toFile(output);
    console.log(`Generated: icon-${size}x${size}.png`);
  }
  console.log('Done! All PWA icons generated.');
}

generate().catch(console.error);
