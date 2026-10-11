import * as ExcelJS from 'exceljs';
import { groupComboLines } from './combo-lines.util';
import { paymentMethodLabel } from '../services/credit.service';

/**
 * Ventas del día en Excel (.xlsx): ventas directas (registradas ese día) y
 * pedidos facturados ese día. Hojas: Resumen, Ventas (un renglón por
 * documento) y Detalle (un renglón por producto). Se arma en el navegador con
 * exceljs a partir de lo que ya devuelven /sales y /orders.
 */

export interface DailyDoc {
  type: 'Venta directa' | 'Pedido';
  code: string;
  at: Date | null;
  customer: string;
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  paymentType: string;
  paymentMethod: string;
  /** Ganancia guardada al facturar (null en ventas anteriores a la función). */
  profit: number | null;
  lines: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
}

const num = (v: any) => Number(v) || 0;

/** 'YYYY-MM-DD' de una fecha en la hora local del navegador. */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function docLines(items: any) {
  let raw = items;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  return groupComboLines(raw).map((l) => {
    const extra = [...(l.components?.length ? [`Incluye: ${l.components.join(', ')}`] : []), ...(l.options || [])];
    return {
      name: extra.length ? `${l.name} (${extra.join(' · ')})` : l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      subtotal: l.subtotal,
    };
  });
}

/** Venta directa → documento, si es del día. La fecha de venta (dtmDate) manda. */
export function saleDoc(sale: any, day: string): DailyDoc | null {
  const created = sale?.dtmCreationDate ? new Date(sale.dtmCreationDate) : null;
  const saleDay = /^\d{4}-\d{2}-\d{2}/.test(sale?.dtmDate || '') ? String(sale.dtmDate).slice(0, 10) : created ? localDay(created) : '';
  if (saleDay !== day) return null;
  const credit = sale.paymentType === 'CREDITO';
  return {
    type: 'Venta directa',
    code: sale.strInvoiceCode || '—',
    at: created && localDay(created) === day ? created : null,
    customer: sale.customerName || 'Sin cliente',
    subtotal: num(sale.subtotal),
    discount: num(sale.discount),
    tax: num(sale.tax),
    deliveryFee: 0,
    total: num(sale.total) || num(sale.fltQuantity) * num(sale.fltUnitPrice),
    paymentType: credit ? 'Crédito' : 'Contado',
    paymentMethod: credit ? '—' : paymentMethodLabel(sale.paymentMethod || 'EFECTIVO'),
    profit: sale.profit === null || sale.profit === undefined ? null : num(sale.profit),
    lines: docLines(sale.items),
  };
}

/** Pedido facturado ese día → documento. */
export function orderDoc(order: any, day: string): DailyDoc | null {
  if (order?.status !== 'INVOICED' || !order.invoicedAt) return null;
  const at = new Date(order.invoicedAt);
  if (isNaN(at.getTime()) || localDay(at) !== day) return null;
  const credit = order.paymentType === 'CREDITO';
  return {
    type: 'Pedido',
    code: order.orderCode || '—',
    at,
    // Invitados del MarketPlace: "Nombre | teléfono | dirección"
    customer: String(order.customerName || 'Sin cliente').split(' | ')[0],
    subtotal: num(order.subtotal),
    discount: num(order.discount),
    tax: num(order.tax),
    deliveryFee: num(order.deliveryFee),
    total: num(order.total),
    paymentType: credit ? 'Crédito' : 'Contado',
    paymentMethod: credit ? '—' : paymentMethodLabel(order.paymentMethod || 'EFECTIVO'),
    profit: order.profit === null || order.profit === undefined ? null : num(order.profit),
    lines: docLines(order.items),
  };
}

export function dailyDocs(sales: any[], orders: any[], day: string): DailyDoc[] {
  const docs = [
    ...(sales || []).map((s) => saleDoc(s, day)),
    ...(orders || []).map((o) => orderDoc(o, day)),
  ].filter((d): d is DailyDoc => !!d);
  return docs.sort((a, b) => (a.at?.getTime() || 0) - (b.at?.getTime() || 0));
}

const MONEY = '"$"#,##0';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle' };
}

/** Arma el libro y lo descarga como "Ventas_YYYY-MM-DD.xlsx". */
export async function downloadDailySalesXlsx(docs: DailyDoc[], day: string, businessName = ''): Promise<void> {
  const buffer = await buildDailySalesWorkbook(docs, day, businessName).xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ventas_${day}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Libro con las hojas Resumen, Ventas y Detalle. */
export function buildDailySalesWorkbook(docs: DailyDoc[], day: string, businessName = ''): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'InOut';
  wb.created = new Date();
  const [y, m, d] = day.split('-').map(Number);
  const dayLabel = new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── Resumen ──
  const sum = (f: (x: DailyDoc) => number, list = docs) => list.reduce((s, x) => s + f(x), 0);
  const withProfit = docs.filter((x) => x.profit !== null);
  const r = wb.addWorksheet('Resumen');
  r.columns = [{ width: 34 }, { width: 18 }];
  r.addRow([`Ventas del día${businessName ? ' · ' + businessName : ''}`]).font = { bold: true, size: 14 };
  r.addRow([dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)]).font = { italic: true, color: { argb: 'FF6B7280' } };
  r.addRow([]);
  const summary: [string, number, boolean][] = [
    ['Ventas directas', docs.filter((x) => x.type === 'Venta directa').length, false],
    ['Pedidos facturados', docs.filter((x) => x.type === 'Pedido').length, false],
    ['Total vendido', sum((x) => x.total), true],
    ['Impuestos', sum((x) => x.tax), true],
    ['Domicilios cobrados', sum((x) => x.deliveryFee), true],
    ['Descuentos', sum((x) => x.discount), true],
    ['Ganancia', sum((x) => x.profit || 0, withProfit), true],
  ];
  for (const [label, value, money] of summary) {
    const row = r.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    if (money) row.getCell(2).numFmt = MONEY;
  }
  if (withProfit.length < docs.length) {
    r.addRow([`* La ganancia no incluye ${docs.length - withProfit.length} documento(s) registrados antes de calcularla.`]).font = {
      italic: true, size: 9, color: { argb: 'FF92400E' },
    };
  }
  r.addRow([]);
  styleHeader(r.addRow(['Forma de pago', 'Total']));
  const byPayment = new Map<string, number>();
  for (const x of docs) {
    const key = x.paymentType === 'Crédito' ? 'Crédito' : `Contado · ${x.paymentMethod}`;
    byPayment.set(key, (byPayment.get(key) || 0) + x.total);
  }
  for (const [k, v] of byPayment) r.addRow([k, v]).getCell(2).numFmt = MONEY;

  // ── Ventas (un renglón por documento) ──
  const v = wb.addWorksheet('Ventas', { views: [{ state: 'frozen', ySplit: 1 }] });
  v.columns = [
    { header: 'Tipo', key: 'type', width: 14 },
    { header: 'Documento', key: 'code', width: 16 },
    { header: 'Hora', key: 'time', width: 9 },
    { header: 'Cliente', key: 'customer', width: 28 },
    { header: 'Productos', key: 'products', width: 48 },
    { header: 'Subtotal', key: 'subtotal', width: 13, style: { numFmt: MONEY } },
    { header: 'Descuento', key: 'discount', width: 12, style: { numFmt: MONEY } },
    { header: 'Impuesto', key: 'tax', width: 12, style: { numFmt: MONEY } },
    { header: 'Domicilio', key: 'deliveryFee', width: 12, style: { numFmt: MONEY } },
    { header: 'Total', key: 'total', width: 14, style: { numFmt: MONEY } },
    { header: 'Forma de pago', key: 'paymentType', width: 13 },
    { header: 'Medio', key: 'paymentMethod', width: 14 },
    { header: 'Ganancia', key: 'profit', width: 13, style: { numFmt: MONEY } },
  ];
  styleHeader(v.getRow(1));
  for (const x of docs) {
    v.addRow({
      ...x,
      time: x.at ? x.at.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '',
      products: x.lines.map((l) => `${l.quantity} x ${l.name}`).join('; '),
      profit: x.profit === null ? '' : x.profit,
    });
  }
  if (docs.length) {
    const total = v.addRow({
      type: 'TOTAL',
      subtotal: sum((x) => x.subtotal),
      discount: sum((x) => x.discount),
      tax: sum((x) => x.tax),
      deliveryFee: sum((x) => x.deliveryFee),
      total: sum((x) => x.total),
      profit: sum((x) => x.profit || 0, withProfit),
    });
    total.font = { bold: true };
  }
  v.autoFilter = { from: 'A1', to: 'M1' };

  // ── Detalle (un renglón por producto) ──
  const det = wb.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 1 }] });
  det.columns = [
    { header: 'Documento', key: 'code', width: 16 },
    { header: 'Tipo', key: 'type', width: 14 },
    { header: 'Producto', key: 'name', width: 50 },
    { header: 'Cantidad', key: 'quantity', width: 10 },
    { header: 'Precio unitario', key: 'unitPrice', width: 15, style: { numFmt: MONEY } },
    { header: 'Subtotal', key: 'subtotal', width: 14, style: { numFmt: MONEY } },
  ];
  styleHeader(det.getRow(1));
  for (const x of docs) for (const l of x.lines) det.addRow({ code: x.code, type: x.type, ...l });
  det.autoFilter = { from: 'A1', to: 'F1' };
  return wb;
}
