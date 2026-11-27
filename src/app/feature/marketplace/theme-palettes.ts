/**
 * Paletas de colores de cada tema de la tienda (mínimo 3 por tema). Se guardan
 * en marketplace_config.palette; null o la primera de la lista = la paleta
 * original del tema. Los colores viven en el CSS de cada tema como variables
 * (menu-board.component.css y marketplace-themes.css), seleccionadas con
 * [data-palette="…"]. Minorista no está aquí: sus tres colores ya son tres
 * temas (grid-rosa, grid-rojo, grid-azul).
 */
export interface ThemePalette {
  value: string;
  label: string;
  /** Muestra en el selector: [fondo, acento]. */
  swatch: [string, string];
}

export const THEME_PALETTES: Record<string, ThemePalette[]> = {
  // Menú
  menu: [
    { value: 'naranja', label: 'Naranja', swatch: ['#fff7ed', '#ea580c'] },
    { value: 'rojo', label: 'Rojo', swatch: ['#fef2f2', '#dc2626'] },
    { value: 'verde', label: 'Verde', swatch: ['#f0fdf4', '#15803d'] },
    { value: 'azul', label: 'Azul', swatch: ['#eff6ff', '#1d4ed8'] },
  ],
  'menu-chalk': [
    { value: 'verde', label: 'Pizarra verde', swatch: ['#1c2a24', '#fde68a'] },
    { value: 'negra', label: 'Pizarra negra', swatch: ['#1d1f22', '#f9a8d4'] },
    { value: 'azul', label: 'Pizarra azul', swatch: ['#18273a', '#a5f3fc'] },
  ],
  'menu-clean': [
    { value: 'dorado', label: 'Negro y dorado', swatch: ['#0e0e10', '#c9a96e'] },
    { value: 'plata', label: 'Negro y plata', swatch: ['#0f1115', '#c5ccd6'] },
    { value: 'vino', label: 'Vino y oro rosa', swatch: ['#1a0b10', '#e0a98c'] },
  ],
  // Tarjetas
  grid: [
    { value: 'azul', label: 'Azul y naranja', swatch: ['#050b1a', '#ff7a1a'] },
    { value: 'morado', label: 'Morado y rosa', swatch: ['#0f0720', '#ec4899'] },
    { value: 'verde', label: 'Verde y ámbar', swatch: ['#03140f', '#f59e0b'] },
  ],
  'grid-fresh': [
    { value: 'verde', label: 'Verde', swatch: ['#f6faf4', '#16a34a'] },
    { value: 'coral', label: 'Coral', swatch: ['#fff8f4', '#f97316'] },
    { value: 'cielo', label: 'Cielo', swatch: ['#f4f9fd', '#0284c7'] },
  ],
  'grid-chic': [
    { value: 'terracota', label: 'Terracota', swatch: ['#faf6ef', '#9a3f1c'] },
    { value: 'oliva', label: 'Oliva', swatch: ['#f7f6ef', '#556b2f'] },
    { value: 'marino', label: 'Azul marino', swatch: ['#f6f7fa', '#1e3a5f'] },
  ],
};

/** Paletas del tema (vacío si el tema no tiene). */
export function palettesFor(mode: string | null | undefined): ThemePalette[] {
  return THEME_PALETTES[mode || 'grid'] || [];
}

/**
 * Paleta que se aplica: la guardada si existe en ese tema y no es la
 * original; null = la original (sin atributo, el CSS de siempre).
 */
export function paletteFor(mode: string | null | undefined, palette: string | null | undefined): string | null {
  const list = palettesFor(mode);
  if (!palette || !list.length || list[0].value === palette) return null;
  return list.some((p) => p.value === palette) ? palette : null;
}

/** Nombre de la paleta elegida ("Rojo"), o el de la original. */
export function paletteLabel(mode: string | null | undefined, palette: string | null | undefined): string {
  const list = palettesFor(mode);
  return (list.find((p) => p.value === palette) || list[0])?.label || '';
}
