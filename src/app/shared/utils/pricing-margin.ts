/**
 * Margen de ganancia en tres niveles (sobre el costo): el del producto o
 * material si lo tiene; si no, el de su categoría; si no, el del período
 * (PORCENTAJE_GANANCIA). Da el PRECIO SUGERIDO. El PISO es el costo total más
 * el margen mínimo del período (MARGEN_MINIMO, 0 = no vender bajo costo).
 * Mismo criterio que el backend (Backend_Inout/src/common/pricing-margin.ts).
 */
export type MarginSource = 'PRODUCTO' | 'CATEGORIA' | 'PERIODO';

const has = (v: unknown) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

export function effectiveMargin(levels: { item?: unknown; category?: unknown; period?: unknown }): { percent: number; source: MarginSource } {
  if (has(levels.item)) return { percent: Number(levels.item), source: 'PRODUCTO' };
  if (has(levels.category)) return { percent: Number(levels.category), source: 'CATEGORIA' };
  return { percent: has(levels.period) ? Number(levels.period) : 0, source: 'PERIODO' };
}

export const priceWithMargin = (cost: number, percent: number) => Math.round((Number(cost) || 0) * (1 + (Number(percent) || 0) / 100) * 100) / 100;

/** Margen real de un precio sobre su costo (null si no hay costo). */
export function actualMargin(price: number, cost: number): number | null {
  const c = Number(cost) || 0;
  if (c <= 0) return null;
  return Math.round((((Number(price) || 0) - c) / c) * 1000) / 10;
}

/** "De la categoría «Bebidas»: 80 %" / "Del período: 35 %". */
export function inheritedMarginLabel(categoryName: string | null, categoryMargin: unknown, periodMargin: number): string {
  return has(categoryMargin)
    ? `De la categoría «${categoryName}»: ${Number(categoryMargin)} %`
    : `Del período: ${Number(periodMargin) || 0} %`;
}

/** Lo que se envía al backend: null = heredar. */
export function marginPayload(mode: 'inherit' | 'custom', value: unknown): number | null {
  return mode === 'custom' && has(value) ? Math.max(0, Math.min(1000, Number(value))) : null;
}
