import { Reservation, ReservationStatus } from '../../shared/services/dining.service';

/** Mesas: estado en vivo de cada mesa y ayudas de la agenda (reglas puras). */

export type TableState = 'free' | 'soon' | 'waiting' | 'late' | 'seated' | 'overdue';

export const TABLE_STATE_LABELS: Record<TableState, string> = {
  free: 'Libre',
  soon: 'Reservada pronto',
  waiting: 'Esperando al cliente',
  late: 'No ha llegado',
  seated: 'Ocupada',
  overdue: 'Por liberar',
};

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: 'Por confirmar',
  CONFIRMED: 'Confirmada',
  SEATED: 'En la mesa',
  COMPLETED: 'Finalizada',
  NO_SHOW: 'No llegó',
  CANCELLED: 'Cancelada',
};

/** Una reserva "pronto" empieza en los próximos 30 min. */
export const SOON_MINUTES = 30;

const ms = (iso: string) => new Date(iso).getTime();
const active = (r: Reservation) => r.status === 'PENDING' || r.status === 'CONFIRMED' || r.status === 'SEATED';

export interface TableLive {
  state: TableState;
  /** La reserva que define el estado (la que está en la mesa o la próxima). */
  current: Reservation | null;
  /** Próximas reservas del día en la mesa, en orden. */
  upcoming: Reservation[];
}

/**
 * Estado de una mesa ahora:
 * - Ocupada / Por liberar (sentados y pasados de la hora).
 * - Esperando al cliente (ya es la hora, dentro de la tolerancia) / No ha llegado (pasó la tolerancia).
 * - Reservada pronto (empieza en los próximos 30 min) / Libre.
 */
export function tableLive(tableId: string, reservations: Reservation[], now: number, toleranceMinutes: number): TableLive {
  const mine = reservations.filter((r) => active(r) && r.tableIds.includes(tableId)).sort((a, b) => ms(a.startAt) - ms(b.startAt));
  const seated = mine.find((r) => r.status === 'SEATED');
  const upcoming = mine.filter((r) => r.status !== 'SEATED' && ms(r.endAt) > now);
  if (seated) return { state: ms(seated.endAt) < now ? 'overdue' : 'seated', current: seated, upcoming };
  const due = upcoming.find((r) => ms(r.startAt) <= now);
  if (due) {
    const late = now > ms(due.startAt) + toleranceMinutes * 60_000;
    return { state: late ? 'late' : 'waiting', current: due, upcoming };
  }
  const next = upcoming[0];
  if (next && ms(next.startAt) - now <= SOON_MINUTES * 60_000) return { state: 'soon', current: next, upcoming };
  return { state: 'free', current: next || null, upcoming };
}

/** Rango de horas de la agenda: el horario habitual, ampliado con las reservas del día. */
export function agendaRange(reservations: Reservation[], date: string, from = 11, to = 23): { startHour: number; endHour: number } {
  let start = from;
  let end = to;
  for (const r of reservations) {
    const s = new Date(r.startAt);
    const e = new Date(r.endAt);
    if (localDate(s) === date) start = Math.min(start, s.getHours());
    if (localDate(e) === date) end = Math.max(end, e.getHours() + (e.getMinutes() ? 1 : 0));
    else if (localDate(s) === date) end = 24;
  }
  return { startHour: Math.max(0, start), endHour: Math.min(24, Math.max(end, start + 1)) };
}

/** Posición y ancho (en %) de una reserva en la fila de la agenda. */
export function agendaBlock(r: Reservation, date: string, startHour: number, endHour: number): { left: number; width: number } | null {
  const day = new Date(`${date}T00:00:00`).getTime();
  const from = day + startHour * 3600_000;
  const to = day + endHour * 3600_000;
  const s = Math.max(ms(r.startAt), from);
  const e = Math.min(ms(r.endAt), to);
  if (e <= s) return null;
  const span = to - from;
  return { left: ((s - from) / span) * 100, width: Math.max(1.5, ((e - s) / span) * 100) };
}

/** 'YYYY-MM-DD' en la hora del equipo. */
export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function hhmm(iso: string | Date): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Siguiente acción principal de una reserva en el panel. */
export function primaryAction(r: Reservation): { label: string; status: ReservationStatus } | null {
  if (r.status === 'PENDING') return { label: 'Confirmar', status: 'CONFIRMED' };
  if (r.status === 'CONFIRMED') return { label: 'Llegó', status: 'SEATED' };
  if (r.status === 'SEATED') return { label: 'Liberar mesa', status: 'COMPLETED' };
  return null;
}
