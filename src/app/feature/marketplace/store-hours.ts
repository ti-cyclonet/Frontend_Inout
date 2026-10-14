/**
 * Horario de atención de la tienda (marketplace_config.scheduling.hours).
 * Mismas reglas que el backend (Backend_Inout/src/orders/scheduling.ts): hora
 * de Colombia (UTC-5 fijo); con `onlyDuringHours` los pedidos "lo antes
 * posible" solo se reciben con la tienda abierta.
 */
export interface DayHours {
  /** 0 = domingo … 6 = sábado */
  day: number;
  active: boolean;
  open: string;
  close: string;
}

export interface StoreSchedule {
  enabled: boolean;
  onlyDuringHours: boolean;
  hours: DayHours[];
}

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const OFFSET_MS = -5 * 3600000;

const toMinutes = (hhmm: string): number | null => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const bogotaDate = (at: Date) => new Date(at.getTime() + OFFSET_MS).toISOString().slice(0, 10);
const bogotaToUtc = (date: string, minutes: number) => new Date(Date.parse(`${date}T00:00:00Z`) + minutes * 60000 - OFFSET_MS);
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const hoursOf = (s: StoreSchedule, day: number) => (s.hours || []).find((h) => h.day === day && h.active && toMinutes(h.open) !== null && toMinutes(h.close)! > toMinutes(h.open)!);

/** '18:30' → '6:30 p. m.' */
export function formatHour(hhmm: string): string {
  const m = toMinutes(hhmm);
  if (m === null) return hhmm;
  const h = Math.floor(m / 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** ¿La tienda muestra su horario? (programación activa o atiende solo en horario) */
export const showsHours = (s: StoreSchedule | null): s is StoreSchedule => !!s && (s.enabled || s.onlyDuringHours) && (s.hours || []).length > 0;

export function isOpenAt(s: StoreSchedule, at: Date): boolean {
  const date = bogotaDate(at);
  const h = hoursOf(s, weekdayOf(date));
  if (!h) return false;
  const t = at.getTime();
  return t >= bogotaToUtc(date, toMinutes(h.open)!).getTime() && t < bogotaToUtc(date, toMinutes(h.close)!).getTime();
}

/** "hoy a las 6:30 p. m." / "mañana a las 8:00 a. m." / "el lunes a las 8:00 a. m.", o null si nunca abre. */
export function nextOpeningLabel(s: StoreSchedule, now: Date): string | null {
  const today = bogotaDate(now);
  for (let i = 0; i <= 7; i++) {
    const date = bogotaDate(new Date(bogotaToUtc(today, 12 * 60).getTime() + i * 86400000));
    const h = hoursOf(s, weekdayOf(date));
    if (!h || bogotaToUtc(date, toMinutes(h.open)!).getTime() <= now.getTime()) continue;
    const when = i === 0 ? 'hoy' : i === 1 ? 'mañana' : `el ${DAY_NAMES[weekdayOf(date)]}`;
    return `${when} a las ${formatHour(h.open)}`;
  }
  return null;
}

/** Estado de hoy para el encabezado de la tienda y la carta. */
export function todayStatus(s: StoreSchedule, now: Date): { open: boolean; label: string } {
  const h = hoursOf(s, weekdayOf(bogotaDate(now)));
  if (isOpenAt(s, now)) return { open: true, label: `Abierto ahora · hasta las ${formatHour(h!.close)}` };
  const next = nextOpeningLabel(s, now);
  return { open: false, label: next ? `Cerrado · abre ${next}` : 'Cerrado' };
}

/** Horario de la semana, de lunes a domingo. */
export function weeklyHours(s: StoreSchedule, now: Date): { day: string; text: string; today: boolean; closed: boolean }[] {
  const today = weekdayOf(bogotaDate(now));
  return [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const h = hoursOf(s, day);
    const name = DAY_NAMES[day];
    return {
      day: name.charAt(0).toUpperCase() + name.slice(1),
      text: h ? `${formatHour(h.open)} – ${formatHour(h.close)}` : 'Cerrado',
      today: day === today,
      closed: !h,
    };
  });
}
