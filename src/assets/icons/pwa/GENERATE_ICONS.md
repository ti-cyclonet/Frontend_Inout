# Íconos de la app (PWA) - InOut

El ícono de la app instalada se genera desde **`icon-master.png`** (1024 × 1024):
fondo blanco con el logo "InOut" y la flecha infinita naranja, de borde a borde.

- El fondo llega hasta el borde y el símbolo queda dentro de la **zona segura**
  (círculo central del 80 %). Android recorta los íconos `maskable` con la forma
  del teléfono (círculo, squircle…); un logo a todo el ancho queda cortado.
- `icon-180x180.png` es el de iPhone (`apple-touch-icon` en `index.html`).

## Regenerar los tamaños

```bash
npm install sharp --save-dev   # si no está instalado
node generate-pwa-icons.js
```

Genera icon-72, 96, 128, 144, 152, 180, 192, 384 y 512 en esta carpeta.

Los teléfonos que ya instalaron la app actualizan el ícono solos cuando Chrome
revisa el manifest (puede tardar unos días); reinstalarla lo muestra de inmediato.
