/**
 * Las ventas y pedidos guardan un combo como las líneas de sus componentes
 * (cada una con `combo.groupId`), para que el stock y el Kardex funcionen por
 * producto. Para MOSTRARLAS se agrupan en una sola línea "Combo X" con lo que
 * incluye. Mismo criterio que el backend (combos/combo-lines.ts).
 */
export interface DisplayLine {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  /** Precio normal por unidad, si hubo promoción. */
  listPrice?: number;
  /** Nombre de la promoción aplicada. */
  promotionName?: string;
  /** Combo: lo que incluye ("1 x Hamburguesa"). */
  components?: string[];
  /** Unidades por fabricar (pedidos bajo pedido). */
  toManufacture?: number;
}

const num = (v: any) => Number(v) || 0;
const lineSubtotal = (it: any) => num(it?.subtotal) || num(it?.total) || num(it?.quantity) * num(it?.unitPrice);

export function groupComboLines(items: any[] | null | undefined): DisplayLine[] {
  const out: DisplayLine[] = [];
  const groups = new Map<string, DisplayLine>();
  for (const it of Array.isArray(items) ? items : []) {
    const info = it?.combo;
    if (!info?.groupId) {
      const promo = it?.promotion;
      out.push({
        name: String(it?.productName || it?.product || it?.name || 'Producto'),
        quantity: num(it?.quantity),
        unitPrice: num(it?.unitPrice),
        subtotal: lineSubtotal(it),
        ...(promo ? { promotionName: promo.name, listPrice: num(it?.listPrice) } : {}),
        ...(num(it?.toManufacture) > 0 ? { toManufacture: num(it.toManufacture) } : {}),
      });
      continue;
    }
    let g = groups.get(info.groupId);
    if (!g) {
      g = {
        name: info.comboName,
        quantity: num(info.comboQuantity),
        unitPrice: num(info.comboUnitPrice),
        subtotal: 0,
        components: [],
        ...(info.promotion ? { promotionName: info.promotion.name, listPrice: num(info.comboListPrice) } : {}),
      };
      groups.set(info.groupId, g);
      out.push(g);
    }
    g.subtotal = Math.round((g.subtotal + lineSubtotal(it)) * 100) / 100;
    const perCombo = num(info.comboQuantity) > 0 ? num(it.quantity) / num(info.comboQuantity) : num(it.quantity);
    g.components!.push(`${Math.round(perCombo * 1000) / 1000} x ${it.productName || 'Producto'}`);
    if (num(it?.toManufacture) > 0) g.toManufacture = (g.toManufacture || 0) + num(it.toManufacture);
  }
  return out;
}

/**
 * Líneas para documentos PDF: el combo va en una sola línea con lo que
 * incluye en el nombre ("Combo Clásico (1 x Hamburguesa, 1 x Papas)").
 */
export function documentLines(items: any[] | null | undefined): { productName: string; quantity: number; unitPrice: number; subtotal: number }[] {
  return groupComboLines(items).map((l) => ({
    productName: l.components?.length ? `${l.name} (${l.components.join(', ')})` : l.name,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    subtotal: l.subtotal,
  }));
}
