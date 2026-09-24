/**
 * Conversión entre unidades de medida del catálogo de InOut (kg, g, mg, lb,
 * oz, l, ml, gal, m, cm, mm, km, in, ft, m2, m3, units, pcs, box, pack, doz).
 *
 * Espejo del util del backend (Backend_Inout/src/common/utils/unit-conversion.ts):
 * se usa para que las vistas previas de costo/stock en el formulario (antes
 * de guardar) coincidan con lo que el backend calculará al procesar la
 * receta/composición.
 */

const FAMILY_UNITS: Record<string, string[]> = {
  mass: ['mg', 'g', 'kg', 'lb', 'oz'],
  volume: ['ml', 'l', 'gal'],
  length: ['mm', 'cm', 'm', 'km', 'in', 'ft'],
  area: ['m2'],
  volume3: ['m3'],
  // Paquete = 6 unidades (equivalencia por defecto del catálogo)
  count: ['units', 'pcs', 'doz', 'pack'],
  box: ['box'],
};

const FACTOR_TO_BASE: Record<string, number> = {
  mg: 0.001, g: 1, kg: 1000, lb: 453.59237, oz: 28.349523125,
  ml: 1, l: 1000, gal: 3785.411784,
  mm: 1, cm: 10, m: 1000, km: 1000000, in: 25.4, ft: 304.8,
  m2: 1,
  m3: 1,
  units: 1, pcs: 1, doz: 12,
  box: 1, pack: 6,
};

function familyOf(unit: string): string | null {
  const key = (unit || '').trim();
  for (const [family, units] of Object.entries(FAMILY_UNITS)) {
    if (units.includes(key)) return family;
  }
  return null;
}

export function areUnitsCompatible(unitA?: string, unitB?: string): boolean {
  if (!unitA || !unitB || unitA === unitB) return true;
  const famA = familyOf(unitA);
  const famB = familyOf(unitB);
  if (!famA || !famB) return true;
  return famA === famB;
}

/** Convierte `value` de `fromUnit` a `toUnit`. Si no se puede (unidad
 * desconocida o familias distintas), retorna `value` sin cambios: el
 * formulario no debe romperse por una vista previa, el backend es quien
 * valida en serio al guardar. */
export function convertUnits(value: number, fromUnit?: string, toUnit?: string): number {
  if (value == null || Number.isNaN(value)) return value;
  if (!fromUnit || !toUnit || fromUnit === toUnit) return value;

  const factorFrom = FACTOR_TO_BASE[fromUnit];
  const factorTo = FACTOR_TO_BASE[toUnit];
  if (factorFrom === undefined || factorTo === undefined) return value;
  if (familyOf(fromUnit) !== familyOf(toUnit)) return value;

  return (value * factorFrom) / factorTo;
}

/** Catálogo de unidades que ofrecen los formularios de materiales. */
export const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'g', label: 'Gramos (g)' },
  { value: 'mg', label: 'Miligramos (mg)' },
  { value: 'lb', label: 'Libras (lb)' },
  { value: 'oz', label: 'Onzas (oz)' },
  { value: 'l', label: 'Litros (l)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'gal', label: 'Galones (gal)' },
  { value: 'km', label: 'Kilómetros (km)' },
  { value: 'm', label: 'Metros (m)' },
  { value: 'cm', label: 'Centímetros (cm)' },
  { value: 'mm', label: 'Milímetros (mm)' },
  { value: 'in', label: 'Pulgadas (in)' },
  { value: 'ft', label: 'Pies (ft)' },
  { value: 'm2', label: 'Metros cuadrados (m²)' },
  { value: 'm3', label: 'Metros cúbicos (m³)' },
  { value: 'units', label: 'Unidades' },
  { value: 'pcs', label: 'Piezas' },
  { value: 'box', label: 'Cajas' },
  { value: 'pack', label: 'Paquetes (6 und)' },
  { value: 'doz', label: 'Docenas' },
];

/**
 * Unidades de descarga válidas para una unidad de medida: las de su misma
 * familia (convertibles entre sí), sin incluir la propia unidad de medida.
 * Ej.: 'm' -> km, cm, mm, in, ft. Vacío si no hay unidad o no tiene
 * relacionadas (m², m³, cajas, paquetes).
 */
export function getDischargeUnitOptions(measureUnit?: string): { value: string; label: string }[] {
  const family = familyOf(measureUnit || '');
  if (!family) return [];
  return UNIT_OPTIONS.filter(o => o.value !== measureUnit && familyOf(o.value) === family);
}

/** Etiqueta legible de una unidad (ej. 'kg' -> 'Kilogramos (kg)'). */
export function unitLabel(unit?: string): string {
  return UNIT_OPTIONS.find(o => o.value === unit)?.label || unit || '';
}
