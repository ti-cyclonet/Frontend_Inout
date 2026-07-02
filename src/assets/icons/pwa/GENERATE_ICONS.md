# PWA Icons - InOut

Los iconos PWA deben generarse a partir del logo fuente ubicado en:
`src/assets/img/logo_inout_v7.png`

## Cómo generar los iconos

1. Asegúrate de tener `sharp` instalado:
   ```bash
   npm install sharp --save-dev
   ```

2. Ejecuta el script de generación desde la raíz del proyecto:
   ```bash
   node generate-pwa-icons.js
   ```

3. Esto generará los siguientes tamaños de iconos en esta carpeta:
   - icon-72x72.png
   - icon-96x96.png
   - icon-128x128.png
   - icon-144x144.png
   - icon-152x152.png
   - icon-192x192.png
   - icon-384x384.png
   - icon-512x512.png

## Notas
- Los iconos deben ser cuadrados con fondo transparente
- Se recomienda regenerar los iconos cada vez que se actualice el logo
- El script usa `sharp` para redimensionar manteniendo la proporción
