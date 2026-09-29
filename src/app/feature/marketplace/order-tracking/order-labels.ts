/** Textos de pedidos del MarketPlace compartidos por el checkout y el seguimiento. */

export const PAYMENT_PLAN_LABELS: Record<string, string> = {
  CONTADO: '💳 Pago anticipado',
  CONTRA_ENTREGA: '💵 Contra entrega',
  MITAD_MITAD: '🌗 50/50',
  PLAN_SEPARE: '🗓️ Plan separe',
  CREDITO: '🧾 A crédito',
};

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
