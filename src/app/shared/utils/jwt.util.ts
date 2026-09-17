/**
 * Decodifica el payload de un JWT. Los JWT usan Base64URL (con "-" y "_"),
 * no Base64 estandar (con "+" y "/"); llamar a atob() directamente sobre el
 * segmento del token falla con "InvalidCharacterError" cada vez que el
 * payload contiene alguno de esos caracteres.
 */
export function decodeJwtPayload<T = any>(token: string): T | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}
