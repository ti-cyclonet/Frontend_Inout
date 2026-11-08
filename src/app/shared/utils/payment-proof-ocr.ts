/**
 * Lee la referencia y el valor del texto (OCR) de un comprobante de pago:
 * Nequi, Daviplata, Bancolombia y otros bancos, o el volante de un datáfono.
 * Busca la etiqueta (Referencia, Comprobante, Aprobación, Autorización…) y
 * toma el código que va en la misma línea o en la siguiente.
 */

/** Etiquetas en orden de preferencia (la primera que aparezca gana). */
const LABELS: RegExp[] = [
  /n[uú]mero\s+de\s+(?:referencia|aprobaci[oó]n|autorizaci[oó]n|comprobante|transacci[oó]n)/i,
  /referencia/i,
  /c[oó]d(?:igo)?\.?\s+de\s+(?:aprobaci[oó]n|autorizaci[oó]n)/i,
  /aprobaci[oó]n|autorizaci[oó]n|\baut\.?\b|\bapro\.?\b/i,
  /comprobante(?:\s+(?:no\.?|n[°º]|#))?/i,
  /(?:n[°º]|no\.)\s+de\s+transacci[oó]n|transacci[oó]n/i,
  /\brrn\b|\brecibo\b/i,
];

/** Código válido: 4–30 caracteres, con al menos 4 dígitos. */
function codeIn(s: string): string | null {
  const tokens = s.replace(/[:#|]/g, ' ').split(/\s+/).map((t) => t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9-]+$/g, ''));
  for (const t of tokens) {
    if (t.length >= 4 && t.length <= 30 && /^[A-Za-z0-9-]+$/.test(t) && (t.match(/\d/g) || []).length >= 4) return t.toUpperCase();
  }
  return null;
}

export function extractReference(text: string): string | null {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const label of LABELS) {
    for (let i = 0; i < lines.length; i++) {
      const m = label.exec(lines[i]);
      if (!m) continue;
      // Lo que sigue a la etiqueta en la misma línea, o la línea siguiente
      const rest = lines[i].slice(m.index + m[0].length);
      const code = codeIn(rest) || (lines[i + 1] ? codeIn(lines[i + 1]) : null);
      if (code) return code;
    }
  }
  return null;
}

/** Valores en pesos del comprobante ($ 12.000, $12.000,00, 12000 COP). */
export function extractAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /\$\s?([\d.,]+)|([\d.,]+)\s?(?:COP|pesos)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text || '')))) {
    let raw = (m[1] || m[2] || '').replace(/[.,]\d{2}$/, '');
    raw = raw.replace(/[.,]/g, '');
    const n = Number(raw);
    if (n > 0 && n < 1e10) out.push(n);
  }
  return out;
}

/**
 * Lee la foto del comprobante en el navegador (Tesseract; la imagen no sale
 * del equipo) y devuelve la referencia y los valores que encontró.
 */
export async function readPaymentProof(file: File): Promise<{ reference: string | null; amounts: number[] }> {
  // tesseract.js es CommonJS: según el empaquetador llega directo o en «default»
  const mod: any = await import('tesseract.js');
  const createWorker = mod.createWorker || mod.default?.createWorker;
  const worker = await createWorker('spa');
  try {
    const { data } = await worker.recognize(file);
    return { reference: extractReference(data.text), amounts: extractAmounts(data.text) };
  } finally {
    await worker.terminate();
  }
}
