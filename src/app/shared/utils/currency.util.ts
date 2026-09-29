/**
 * Valores de pedidos en pesos colombianos con el formato "$2.362.200":
 * símbolo pegado, punto de miles y sin decimales (se redondea al peso).
 */
export function formatCop(value: number | string | null | undefined): string {
  const n = Math.round(Number(value) || 0);
  const abs = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.abs(n));
  return `${n < 0 ? '-' : ''}$${abs}`;
}
