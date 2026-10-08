import { compararPorFechaVenta, fechaVenta } from './fecha-venta';

describe('fechaVenta', () => {
  it('usa la fecha de venta aunque se haya registrado otro día', () => {
    const f = fechaVenta({ dtmDate: '2026-09-20', dtmCreationDate: new Date(2026, 9, 8, 15, 26).toISOString() })!;
    expect([f.getFullYear(), f.getMonth(), f.getDate()]).toEqual([2026, 8, 20]);
  });

  it('si se registró el mismo día conserva la hora real', () => {
    const creada = new Date(2026, 9, 8, 10, 26);
    expect(fechaVenta({ dtmDate: '2026-10-08', dtmCreationDate: creada.toISOString() })!.getTime()).toBe(creada.getTime());
  });

  it('no corre el día por leer la fecha como UTC', () => {
    expect(fechaVenta({ dtmDate: '2026-10-01', dtmCreationDate: null })!.getDate()).toBe(1);
  });

  it('sin fecha de venta usa la de registro; sin ninguna, nada', () => {
    const creada = new Date(2026, 9, 8, 9, 0);
    expect(fechaVenta({ dtmCreationDate: creada.toISOString() })!.getTime()).toBe(creada.getTime());
    expect(fechaVenta({})).toBeNull();
    expect(fechaVenta(null)).toBeNull();
  });

  it('ordena de la venta más reciente a la más antigua', () => {
    const ventas = [{ dtmDate: '2026-09-12' }, { dtmDate: '2026-10-05' }, { dtmDate: '2026-09-30' }];
    expect(ventas.sort(compararPorFechaVenta).map((v) => v.dtmDate)).toEqual(['2026-10-05', '2026-09-30', '2026-09-12']);
  });
});
