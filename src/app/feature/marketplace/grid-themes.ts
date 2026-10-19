/**
 * Temas de la vista de tarjetas del MarketPlace. Se guardan en
 * marketplace_config.displayMode junto a los diseños de menú: 'grid' es el
 * tema original (Nocturno); los demás cambian solo la apariencia (colores,
 * tipografía y forma de las tarjetas), no el contenido ni el carrito.
 * La columna displayMode admite 10 caracteres: Boutique se guarda como grid-chic.
 *
 * Minorista es un tema para el comercio minorista (sector retail) en tres
 * versiones: grid-rosa (boutique), grid-rojo (volante de ofertas) y grid-azul
 * (catálogo), cada una con su color, su tarjeta y su distribución.
 */
export type GridTheme = 'grid' | 'grid-fresh' | 'grid-chic' | 'grid-rosa' | 'grid-rojo' | 'grid-azul';

export interface GridThemeOption {
  value: GridTheme;
  label: string;
  hint: string;
  /** Tema para el comercio minorista (se ofrece a las tiendas de ese sector). */
  retail?: boolean;
  /** Color de muestra en el selector. */
  swatch?: string;
}

export const GRID_THEMES: GridThemeOption[] = [
  { value: 'grid', label: 'Nocturno', hint: 'Fondo oscuro con brillos azul y naranja: el estilo de InOut' },
  { value: 'grid-fresh', label: 'Fresco', hint: 'Claro y natural, acento verde y tarjetas suaves' },
  { value: 'grid-chic', label: 'Boutique', hint: 'Marfil y negro, títulos con serifa y líneas finas' },
  { value: 'grid-rosa', label: 'Minorista · Rosa', hint: 'Boutique: 3 columnas amplias con el precio sobre la foto, en rosa', retail: true, swatch: '#db2777' },
  { value: 'grid-rojo', label: 'Minorista · Rojo', hint: 'Volante de ofertas: 5 columnas compactas y precio grande, en rojo', retail: true, swatch: '#dc2626' },
  { value: 'grid-azul', label: 'Minorista · Azul', hint: 'Catálogo: tarjetas horizontales en 2 columnas, en azul', retail: true, swatch: '#2563eb' },
];

/** Paleta del tema Minorista (null = no es el tema Minorista). */
export function gridPaletteAttr(mode: string | null | undefined): 'rosa' | 'rojo' | 'azul' | null {
  if (mode === 'grid-rosa') return 'rosa';
  if (mode === 'grid-rojo') return 'rojo';
  if (mode === 'grid-azul') return 'azul';
  return null;
}

export function isGridMode(mode: string | null | undefined): boolean {
  return !mode || GRID_THEMES.some((t) => t.value === mode);
}

/** Atributo data-theme del componente (null = tema original). */
export function gridThemeAttr(mode: string | null | undefined): 'fresh' | 'boutique' | 'retail' | null {
  if (mode === 'grid-fresh') return 'fresh';
  if (mode === 'grid-chic') return 'boutique';
  if (gridPaletteAttr(mode)) return 'retail';
  return null;
}
