import { KitchenOrder, channelLabel, isWaitingSchedule, kitchenAction, kitchenTimer } from './kitchen.util';

describe('Pantalla de preparación', () => {
  const now = new Date('2026-11-06T20:00:00Z').getTime();
  const min = (m: number) => new Date(now + m * 60000).toISOString();
  const order = (o: Partial<KitchenOrder> = {}): KitchenOrder => ({
    id: 'o1', orderCode: 'PD-1', status: 'IN_PRODUCTION', customerName: 'Ana', notes: null, fulfillment: 'PICKUP',
    deliveryZone: null, createdAt: min(-30), items: [{ productName: 'Arepa', quantity: 2 }],
    needsProduction: true, stageEnteredAt: min(-12), stageDueAt: null, scheduledStart: null, scheduledEnd: null,
    estimatedStartAt: null, estimatedReadyAt: null, ...o,
  });

  it('tiempos: a tiempo, por vencerse y atrasado', () => {
    expect(kitchenTimer(order({ stageDueAt: min(10) }), now, 20)).toEqual({ level: 'ok', elapsed: '12 min', due: 'Faltan 10 min' });
    expect(kitchenTimer(order({ stageDueAt: min(3) }), now, 20).level).toBe('warn');
    expect(kitchenTimer(order({ stageDueAt: min(-6) }), now, 20)).toEqual({ level: 'late', elapsed: '12 min', due: 'Atrasado 6 min' });
    expect(kitchenTimer(order(), now, 0)).toEqual({ level: 'none', elapsed: '12 min', due: '' });
  });

  it('programados: esperan hasta su hora de empezar', () => {
    expect(isWaitingSchedule(order({ status: 'CONFIRMED', scheduledStart: min(90), estimatedStartAt: min(60) }), now)).toBeTrue();
    expect(isWaitingSchedule(order({ status: 'CONFIRMED', scheduledStart: min(30), estimatedStartAt: min(-5) }), now)).toBeFalse();
    expect(isWaitingSchedule(order({ status: 'CONFIRMED' }), now)).toBeFalse();
  });

  it('siguiente paso según la etapa', () => {
    expect(kitchenAction(order({ status: 'CONFIRMED' }))).toEqual({ label: 'Empezar', next: 'IN_PRODUCTION' });
    expect(kitchenAction(order({ status: 'CONFIRMED', needsProduction: false }))).toEqual({ label: 'Listo', next: 'READY' });
    expect(kitchenAction(order())).toEqual({ label: 'Listo', next: 'READY' });
    expect(kitchenAction(order({ status: 'READY' }))).toEqual({ label: 'Entregado', next: 'DELIVERED' });
    expect(kitchenAction(order({ status: 'READY', fulfillment: 'DELIVERY' }))).toBeNull();
  });

  it('canal del pedido', () => {
    expect(channelLabel(order({ fulfillment: 'DELIVERY', deliveryZone: 'Turbaco' })).text).toBe('Domicilio · Turbaco');
    expect(channelLabel(order()).text).toBe('Recoge en el local');
  });
});
