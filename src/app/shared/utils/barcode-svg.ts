/**
 * Dibuja códigos de barras como SVG para imprimir etiquetas.
 * - EAN-13 si el código es un EAN-13 válido (13 dígitos con su dígito de control).
 * - Code 128 para cualquier otro: el lector devuelve exactamente lo guardado.
 *   Todo dígitos y de largo par → juego C (más corto); si no, juego B.
 */

const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const invert = (bits: string) => bits.replace(/[01]/g, (b) => (b === '0' ? '1' : '0'));
const EAN_R = EAN_L.map(invert);
const EAN_G = EAN_R.map((r) => r.split('').reverse().join(''));

/** Anchos barra/espacio de Code 128 (valores 0–106; 103–105 son los inicios, 106 el fin). */
const C128 = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const START_C = 105;
const STOP = 106;

/** Dígito de control EAN-13 de los 12 primeros dígitos. */
export function ean13CheckDigit(first12: string): number {
  const sum = first12.split('').reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

export function isEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** Módulos (1 = barra) de un EAN-13, sin zonas de silencio. */
export function ean13Modules(code: string): string {
  if (!isEan13(code)) throw new Error(`EAN-13 no válido: ${code}`);
  const parity = EAN_PARITY[Number(code[0])];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? EAN_L : EAN_G)[Number(code[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += EAN_R[Number(code[i])];
  return bits + '101';
}

/** Valores de símbolo de Code 128 (inicio, datos, control y fin). */
export function code128Values(code: string): number[] {
  const useC = /^\d+$/.test(code) && code.length % 2 === 0 && code.length >= 4;
  const values = [useC ? START_C : START_B];
  if (useC) {
    for (let i = 0; i < code.length; i += 2) values.push(Number(code.slice(i, i + 2)));
  } else {
    for (const ch of code) {
      const c = ch.charCodeAt(0);
      if (c < 32 || c > 127) throw new Error(`Carácter no admitido en Code 128: ${ch}`);
      values.push(c - 32);
    }
  }
  const check = values.reduce((s, v, i) => s + v * (i || 1), 0) % 103;
  return [...values, check, STOP];
}

/** Módulos (1 = barra) de un Code 128, sin zonas de silencio. */
export function code128Modules(code: string): string {
  return code128Values(code)
    .map((v) => C128[v].split('').map((w, i) => (i % 2 ? '0' : '1').repeat(Number(w))).join(''))
    .join('');
}

/** Módulos del código (1 = barra) con el ancho total incluidas las zonas de silencio. */
export function barcodeModules(code: string): { bits: string; quietLeft: number; total: number } {
  const ean = isEan13(code);
  const bits = ean ? ean13Modules(code) : code128Modules(code);
  const quietLeft = ean ? 11 : 10;
  return { bits, quietLeft, total: quietLeft + bits.length + (ean ? 7 : 10) };
}

/**
 * SVG del código con sus zonas de silencio. El ancho lo pone quien lo usa
 * (el SVG se estira sin perder la proporción de las barras).
 */
export function barcodeSvg(code: string, heightModules = 50): string {
  const { bits, quietLeft, total } = barcodeModules(code);
  let rects = '';
  for (let i = 0; i < bits.length; ) {
    if (bits[i] !== '1') { i++; continue; }
    let j = i;
    while (bits[j] === '1') j++;
    rects += `<rect x="${quietLeft + i}" y="0" width="${j - i}" height="${heightModules}"/>`;
    i = j;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${heightModules}" preserveAspectRatio="none" shape-rendering="crispEdges" fill="#000">${rects}</svg>`;
}

/**
 * Código nuevo para un ítem que no tiene: EAN-13 con prefijo 20 (rango
 * reservado al uso interno de cada tienda, no choca con códigos de
 * fabricantes) más 10 dígitos al azar y el de control.
 */
export function newStoreEan13(random: () => number = Math.random): string {
  let body = '20';
  while (body.length < 12) body += Math.floor(random() * 10);
  return body + ean13CheckDigit(body);
}
