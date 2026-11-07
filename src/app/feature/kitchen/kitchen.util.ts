/** Pantalla de preparación: reglas puras (canal, tiempos y siguiente paso). */

export interface KitchenOrder {
  id: string;
  orderCode: string;
  status: 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | string;
  customerName: string;
  notes: string | null;
  fulfillment: 'DELIVERY' | 'PICKUP' | 'DINE_IN' | null;
  /** Comer en el local: la mesa de la reserva. */
  table?: string | null;
  deliveryZone: string | null;
  createdAt: string;
  /** Combos con lo que incluyen; productos para armar con lo escogido. */
  items: { productName: string; quantity: number; options?: string[]; components?: string[] }[];
  needsProduction: boolean;
  stageEnteredAt: string | null;
  stageDueAt: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  estimatedStartAt: string | null;
  estimatedReadyAt: string | null;
}

export type TimerLevel = 'ok' | 'warn' | 'late' | 'none';

export interface KitchenTimer {
  level: TimerLevel;
  /** Tiempo en la etapa: "8 min". */
  elapsed: string;
  /** "Faltan 4 min" / "Atrasado 6 min" / "". */
  due: string;
}

export function minutesText(total: number): string {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/**
 * Tiempo del pedido en su etapa. Con duración configurada (Tiempos por
 * etapa del tablero): ámbar desde el 80 % del tiempo (o a 3 min del límite)
 * y rojo cuando se pasa.
 */
export function kitchenTimer(o: KitchenOrder, now: number, expectedMinutes: number): KitchenTimer {
  const since = o.stageEnteredAt || o.createdAt;
  const elapsedMin = since ? (now - new Date(since).getTime()) / 60000 : 0;
  const elapsed = minutesText(elapsedMin);
  if (!o.stageDueAt) return { level: 'none', elapsed, due: '' };
  const left = (new Date(o.stageDueAt).getTime() - now) / 60000;
  if (left < 0) return { level: 'late', elapsed, due: `Atrasado ${minutesText(-left)}` };
  const warn = left <= 3 || (expectedMinutes > 0 && left <= expectedMinutes * 0.2);
  return { level: warn ? 'warn' : 'ok', elapsed, due: `Faltan ${minutesText(left)}` };
}

/** Programado: cuándo debe empezar a prepararse (o la franja, si no hay estimado). */
export function scheduleStartsAt(o: KitchenOrder): Date | null {
  if (!o.scheduledStart) return null;
  return new Date(o.estimatedStartAt || o.scheduledStart);
}

/** Pedido programado que aún no debe empezar: espera en la franja de programados. */
export function isWaitingSchedule(o: KitchenOrder, now: number): boolean {
  const start = scheduleStartsAt(o);
  return o.status === 'CONFIRMED' && !!start && start.getTime() > now;
}

export function channelLabel(o: KitchenOrder): { text: string; icon: string } {
  if (o.fulfillment === 'DELIVERY') return { text: o.deliveryZone ? `Domicilio · ${o.deliveryZone}` : 'Domicilio', icon: 'truck' };
  if (o.fulfillment === 'PICKUP') return { text: 'Recoge en el local', icon: 'bag' };
  if (o.fulfillment === 'DINE_IN') return { text: o.table ? `En el local · ${o.table}` : 'Come en el local', icon: 'grid-3x3-gap' };
  return { text: 'Pedido', icon: 'receipt' };
}

/**
 * Lo que la cocina puede hacer con la comanda. Por preparar → Empezar (o
 * Listo, si no hay nada que preparar); En preparación → Listo; Listo y
 * recoge en el local → Entregado. Los domicilios salen desde Pedidos.
 */
export function kitchenAction(o: KitchenOrder): { label: string; next: string } | null {
  if (o.status === 'CONFIRMED') return o.needsProduction ? { label: 'Empezar', next: 'IN_PRODUCTION' } : { label: 'Listo', next: 'READY' };
  if (o.status === 'IN_PRODUCTION') return { label: 'Listo', next: 'READY' };
  if (o.status === 'READY' && o.fulfillment === 'PICKUP') return { label: 'Entregado', next: 'DELIVERED' };
  if (o.status === 'READY' && o.fulfillment === 'DINE_IN') return { label: 'Servido', next: 'DELIVERED' };
  return null;
}
