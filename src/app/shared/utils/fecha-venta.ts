/**
 * Fecha de una venta para mostrarla: la fecha de venta (`dtmDate`, la que se
 * registra en la venta) con la hora real de registro si fue el mismo día.
 * Antes el listado mostraba solo `dtmCreationDate`, así que una venta
 * registrada con otra fecha salía con el día en que se digitó. Misma regla que
 * `saleAt()` en los paneles del backend.
 *
 * `dtmDate` llega como 'YYYY-MM-DD': no se pasa a `new Date()` directo, que lo
 * leería como medianoche UTC (el día anterior en Colombia).
 */
export function fechaVenta(sale: { dtmDate?: string | null; dtmCreationDate?: string | null } | null | undefined): Date | null {
  if (!sale) return null;
  const creada = sale.dtmCreationDate ? new Date(sale.dtmCreationDate) : null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(sale.dtmDate || '');
  if (!m) return creada && !isNaN(creada.getTime()) ? creada : null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  if (creada && !isNaN(creada.getTime()) && creada.getFullYear() === anio && creada.getMonth() === mes && creada.getDate() === dia) return creada;
  return new Date(anio, mes, dia, 12, 0, 0);
}

/** Para ordenar: la más reciente primero (por fecha de venta y, a igual fecha, por registro). */
export function compararPorFechaVenta(
  a: { dtmDate?: string | null; dtmCreationDate?: string | null },
  b: { dtmDate?: string | null; dtmCreationDate?: string | null },
): number {
  return (fechaVenta(b)?.getTime() || 0) - (fechaVenta(a)?.getTime() || 0);
}
