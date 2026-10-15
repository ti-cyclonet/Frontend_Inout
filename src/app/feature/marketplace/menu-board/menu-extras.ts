/**
 * Información de la carta del MarketPlace (no son productos): bloques como
 * "Proteínas" o "Salsas", subtítulo, zonas de domicilio y "solo domicilios".
 * El backend la normaliza (Backend_Inout/src/marketplace-config/menu-extras.ts,
 * mismos límites). Un renglón con precio (adición) suma al producto que lo usa.
 */
import { formatCop } from '../../../shared/utils/currency.util';

export interface MenuExtraItem {
  name: string;
  note: string;
  /** Valor adicional en pesos; 0 = sin costo. */
  price: number;
  imageUrl: string | null;
  imagePublicId: string | null;
}

export interface MenuExtraBlock {
  title: string;
  items: MenuExtraItem[];
}

export interface MenuExtras {
  subtitle: string;
  deliveryOnly: boolean;
  deliveryZones: string[];
  blocks: MenuExtraBlock[];
}

export const EMPTY_MENU_EXTRAS: MenuExtras = { subtitle: '', deliveryOnly: false, deliveryZones: [], blocks: [] };

export const MENU_EXTRAS_LIMITS = {
  subtitle: 60,
  zones: 12,
  zone: 40,
  blocks: 6,
  blockTitle: 40,
  items: 20,
  itemName: 50,
  itemNote: 60,
  itemPrice: 1_000_000,
};

/** Precio en pesos enteros dentro del tope; cualquier otra cosa = 0. */
export function extraPrice(value: unknown): number {
  const n = typeof value === 'string' ? Number(value.replace(/[^\d]/g, '')) : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), MENU_EXTRAS_LIMITS.itemPrice) : 0;
}

/** Nota que es solo un valor ("$3000"): antes el precio se escribía ahí (igual que el backend). */
const MONEY_NOTE = /^\+?\s*\$\s*\d{1,3}(?:[.,\s]?\d{3})*\s*(?:cop)?$/i;

/** "+$3.000" (vacío si no cuesta). */
export function extraPriceLabel(price: number | null | undefined): string {
  return Number(price) > 0 ? `+${formatCop(Number(price))}` : '';
}

function itemFrom(i: any): MenuExtraItem {
  let note = typeof i.note === 'string' ? i.note : '';
  let price = extraPrice(i.price);
  if (!price && MONEY_NOTE.test(note.trim())) {
    price = extraPrice(note);
    note = '';
  }
  return { name: i.name, note, price, imageUrl: i.imageUrl || null, imagePublicId: i.imagePublicId || null };
}

/** Lo que llega del backend (marketplace_config.menuExtras), tolerando nulos. */
export function menuExtrasFrom(raw: any): MenuExtras {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    subtitle: typeof src.subtitle === 'string' ? src.subtitle : '',
    deliveryOnly: src.deliveryOnly === true,
    deliveryZones: Array.isArray(src.deliveryZones) ? src.deliveryZones.filter((z: any) => typeof z === 'string' && z.trim()) : [],
    blocks: (Array.isArray(src.blocks) ? src.blocks : [])
      .filter((b: any) => b && typeof b.title === 'string' && Array.isArray(b.items))
      .map((b: any) => ({
        title: b.title,
        items: b.items
          .filter((i: any) => i && typeof i.name === 'string' && i.name.trim())
          .map(itemFrom),
      }))
      .filter((b: MenuExtraBlock) => b.items.length),
  };
}

/** "Turbaco y Bonanza" / "Turbaco, Bonanza y Arjona". */
export function joinZones(zones: string[]): string {
  if (zones.length <= 1) return zones[0] || '';
  return `${zones.slice(0, -1).join(', ')} y ${zones[zones.length - 1]}`;
}

/** Miniatura cuadrada servida por Cloudinary (sin guardar copias). */
export function extraThumb(url: string | null, size = 160): string | null {
  if (!url) return null;
  const marker = '/image/upload/';
  const i = url.indexOf(marker);
  if (i < 0) return url;
  return `${url.slice(0, i + marker.length)}c_fill,w_${size},h_${size},f_auto,q_auto/${url.slice(i + marker.length)}`;
}

/** Plantillas para empezar rápido (renglones de ejemplo que la tienda edita). */
export const MENU_EXTRA_TEMPLATES: MenuExtraBlock[] = [
  { title: 'Proteínas', items: ['Pollo', 'Carne', 'Cerdo'].map((name) => ({ name, note: '', price: 0, imageUrl: null, imagePublicId: null })) },
  { title: 'Salsas', items: ['Salsa de tomate', 'Salsa de piña', 'Salsa de ajo'].map((name) => ({ name, note: '', price: 0, imageUrl: null, imagePublicId: null })) },
  { title: 'Adiciones', items: [{ name: 'Queso extra', note: '', price: 3000, imageUrl: null, imagePublicId: null }] },
];
