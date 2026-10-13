/**
 * Bonos de regalo (tarjeta regalo) del MarketPlace. Mismas reglas que el
 * backend (Backend_Inout/src/orders/gift-cards/gift-cards.ts): se compran con
 * las formas de pago de la tienda, se activan al quedar pagados o facturados y
 * se usan como pago solo con una cuenta de cliente registrada en la tienda.
 */
import { formatCop } from '../../../shared/utils/currency.util';

export interface GiftCardOptions {
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  presets: number[];
  validityMonths: number;
}

export const DEFAULT_GIFT_CARD_OPTIONS: GiftCardOptions = { enabled: false, minAmount: 10000, maxAmount: 500000, presets: [20000, 50000, 100000], validityMonths: 12 };

/** Lo que llena el comprador (va en la línea del carrito). */
export interface GiftCardDraft {
  amount: number;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  senderName?: string;
  message?: string;
}

export type GiftCardStatus = 'PENDIENTE' | 'ACTIVO' | 'AGOTADO' | 'VENCIDO' | 'ANULADO';

export interface GiftCardView {
  id: string;
  code: string | null;
  amount: number;
  balance: number;
  status: GiftCardStatus;
  recipientName: string;
  recipientEmail?: string | null;
  senderName?: string | null;
  message?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
}

export const GIFT_CARD_PRODUCT_ID = 'gift-card';
export const GIFT_CARD_ITEM_TYPE = 'gift_card';

export const GIFT_CARD_STATUS_LABELS: Record<GiftCardStatus, string> = {
  PENDIENTE: 'Por activar',
  ACTIVO: 'Activo',
  AGOTADO: 'Agotado',
  VENCIDO: 'Vencido',
  ANULADO: 'Anulado',
};

export function giftCardOptionsFrom(raw: any): GiftCardOptions {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: s.enabled === true,
    minAmount: Number(s.minAmount) || DEFAULT_GIFT_CARD_OPTIONS.minAmount,
    maxAmount: Number(s.maxAmount) || DEFAULT_GIFT_CARD_OPTIONS.maxAmount,
    presets: Array.isArray(s.presets) ? s.presets.map(Number).filter((n: number) => n > 0) : [],
    validityMonths: Number(s.validityMonths) || DEFAULT_GIFT_CARD_OPTIONS.validityMonths,
  };
}

/** Reparte el total entre los bonos escogidos (los que vencen primero, primero). */
export function allocateGiftCards(total: number, cards: GiftCardView[]): { id: string; amount: number }[] {
  let remaining = Math.max(0, Math.round(total));
  const sorted = [...cards].sort((a, b) => new Date(a.expiresAt || 0).getTime() - new Date(b.expiresAt || 0).getTime());
  const out: { id: string; amount: number }[] = [];
  for (const c of sorted) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, Math.floor(c.balance));
    if (amount > 0) {
      out.push({ id: c.id, amount });
      remaining -= amount;
    }
  }
  return out;
}

export function formatExpiry(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

/** Mensaje para compartir el bono por WhatsApp. */
export function giftCardShareText(card: GiftCardView, storeName: string, storeUrl: string): string {
  const from = card.senderName ? `${card.senderName} te regaló` : 'Te regalaron';
  const lines = [
    `🎁 ¡Hola ${card.recipientName}! ${from} un bono de ${formatCop(card.amount)} para comprar en ${storeName}.`,
    card.message ? `"${card.message}"` : '',
    `Tu código: ${card.code}`,
    `Entra a ${storeUrl}, crea tu cuenta${card.recipientEmail ? ` con ${card.recipientEmail}` : ''} y úsalo al pagar.`,
    card.expiresAt ? `Vence el ${formatExpiry(card.expiresAt)}.` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** wa.me con el número del destinatario (Colombia) si lo hay. */
export function whatsappShareUrl(text: string, phone?: string | null): string {
  const digits = (phone || '').replace(/\D/g, '');
  const to = digits.length === 10 ? `57${digits}` : digits.length >= 11 ? digits : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}
