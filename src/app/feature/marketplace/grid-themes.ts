/**
 * Temas de la vista de tarjetas del MarketPlace. Se guardan en
 * marketplace_config.displayMode junto a los diseños de menú: 'grid' es el
 * tema original (Nocturno); los demás cambian solo la apariencia (colores,
 * tipografía y forma de las tarjetas), no el contenido ni el carrito.
 */
export type GridTheme = 'grid' | 'grid-fresh' | 'grid-boutique';

export const GRID_THEMES: { value: GridTheme; label: string; hint: string }[] = [
  { value: 'grid', label: 'Nocturno', hint: 'Fondo oscuro con brillos azul y naranja: el estilo de InOut' },
  { value: 'grid-fresh', label: 'Fresco', hint: 'Claro y natural, acento verde y tarjetas suaves' },
  { value: 'grid-boutique', label: 'Boutique', hint: 'Marfil y negro, títulos con serifa y líneas finas' },
];

export function isGridMode(mode: string | null | undefined): boolean {
  return !mode || GRID_THEMES.some((t) => t.value === mode);
}

/** Atributo data-theme del componente (null = tema original). */
export function gridThemeAttr(mode: string | null | undefined): 'fresh' | 'boutique' | null {
  if (mode === 'grid-fresh') return 'fresh';
  if (mode === 'grid-boutique') return 'boutique';
  return null;
}
