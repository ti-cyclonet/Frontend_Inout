/** Textos de pedidos del MarketPlace compartidos por el checkout y el seguimiento. */

export const PAYMENT_PLAN_LABELS: Record<string, string> = {
  CONTADO: '💳 Pago anticipado',
  CONTRA_ENTREGA: '💵 Contra entrega',
  MITAD_MITAD: '🌗 50/50',
  PLAN_SEPARE: '🗓️ Plan separe',
  CREDITO: '🧾 A crédito',
};

/** "🌗 30/70": anticipo / saldo según el porcentaje configurado por la tienda. */
export function splitPlanLabel(depositPercent: number): string {
  const p = Math.min(99, Math.max(1, Math.round(Number(depositPercent) || 50)));
  return `🌗 ${p}/${100 - p}`;
}

/**
 * Etiqueta de la forma de pago. El 50/50 muestra el reparto real: con
 * `depositPercent` (checkout) o, en un pedido ya creado, deducido de su
 * anticipo y su total.
 */
export function planLabel(
  plan: string | null | undefined,
  ctx: { depositPercent?: number; depositRequired?: number | string; total?: number | string } = {},
): string {
  if (!plan) return '';
  if (plan === 'MITAD_MITAD') {
    if (ctx.depositPercent) return splitPlanLabel(ctx.depositPercent);
    const deposit = Number(ctx.depositRequired);
    const total = Number(ctx.total);
    if (deposit > 0 && total > 0) return splitPlanLabel((deposit / total) * 100);
  }
  return PAYMENT_PLAN_LABELS[plan] || plan;
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  SIN_PAGO: 'Sin pagos',
  ANTICIPO_PENDIENTE: 'Anticipo pendiente',
  ANTICIPO_CUBIERTO: 'Anticipo recibido',
  PARCIAL: 'Abonado parcialmente',
  PAGADO: 'Pagado',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Recibido',
  IN_PRODUCTION: 'En preparación',
  READY: 'Listo',
  OUT_FOR_DELIVERY: 'En reparto',
  DELIVERED: 'Entregado',
  INVOICED: 'Entregado',
  CANCELLED: 'Cancelado',
};

/** "mié, 30 sep · 10:00 a. m. – 11:00 a. m." */
export function formatScheduleRange(start: string, end?: string | null): string {
  const s = new Date(start);
  const day = s.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
  const from = s.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  const to = end ? new Date(end).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : '';
  return `${day} · ${from}${to ? ' – ' + to : ''}`;
}
