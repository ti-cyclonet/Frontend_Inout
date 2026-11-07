import { Reservation } from '../../shared/services/dining.service';
import { agendaBlock, agendaRange, primaryAction, tableLive } from './dining.util';

describe('Mesas: estado en vivo y agenda', () => {
  const day = '2026-11-06';
  const at = (h: number, m = 0) => new Date(2026, 10, 6, h, m).toISOString();
  const now = new Date(2026, 10, 6, 19, 0).getTime();
  const res = (o: Partial<Reservation>): Reservation => ({
    id: 'r', code: 'RS-00001', tableIds: ['t1'], customerId: null, customerName: 'Ana', customerPhone: null, customerEmail: null,
    partySize: 2, startAt: at(20), endAt: at(21, 30), status: 'CONFIRMED', source: 'STAFF', notes: null, orderId: null, seatedAt: null, ...o,
  });

  it('libre, reservada pronto, esperando y no ha llegado', () => {
    expect(tableLive('t1', [], now, 15).state).toBe('free');
    expect(tableLive('t1', [res({ startAt: at(21) })], now, 15).state).toBe('free');
    expect(tableLive('t1', [res({ startAt: at(19, 20) })], now, 15).state).toBe('soon');
    expect(tableLive('t1', [res({ startAt: at(18, 50) })], now, 15).state).toBe('waiting');
    expect(tableLive('t1', [res({ startAt: at(18, 30) })], now, 15).state).toBe('late');
    expect(tableLive('t2', [res({ startAt: at(19, 20) })], now, 15).state).toBe('free');
  });

  it('ocupada y por liberar; las canceladas no cuentan', () => {
    expect(tableLive('t1', [res({ status: 'SEATED', startAt: at(18), endAt: at(19, 30) })], now, 15).state).toBe('seated');
    expect(tableLive('t1', [res({ status: 'SEATED', startAt: at(17), endAt: at(18, 30) })], now, 15).state).toBe('overdue');
    expect(tableLive('t1', [res({ status: 'CANCELLED', startAt: at(19, 10) })], now, 15).state).toBe('free');
  });

  it('agenda: rango del día y posición de cada reserva', () => {
    expect(agendaRange([], day)).toEqual({ startHour: 11, endHour: 23 });
    expect(agendaRange([res({ startAt: at(9), endAt: at(10, 30) })], day)).toEqual({ startHour: 9, endHour: 23 });
    const b = agendaBlock(res({ startAt: at(12), endAt: at(14) }), day, 11, 23)!;
    expect(Math.round(b.left * 100) / 100).toBe(8.33);
    expect(Math.round(b.width * 100) / 100).toBe(16.67);
  });

  it('acción principal según el estado', () => {
    expect(primaryAction(res({ status: 'PENDING' }))?.status).toBe('CONFIRMED');
    expect(primaryAction(res({ status: 'CONFIRMED' }))?.label).toBe('Llegó');
    expect(primaryAction(res({ status: 'SEATED' }))?.status).toBe('COMPLETED');
    expect(primaryAction(res({ status: 'COMPLETED' }))).toBeNull();
  });
});
