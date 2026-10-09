/**
 * Textos de la modal de agradecimiento al entregar el pedido. La tienda los
 * cambia en el MarketPlace (modo administrador); el backend los normaliza
 * (Backend_Inout/src/orders/thanks-messages.ts, mismos valores por defecto).
 *
 * Marcadores: {nombre} = primer nombre del cliente, {pedido} = código del pedido.
 */
/** Diseño de la tarjeta (mismos valores que THANKS_STYLES del backend). */
export type ThanksStyle = 'clasico' | 'postal' | 'nocturno';

export const THANKS_STYLES: { value: ThanksStyle; label: string; hint: string }[] = [
  { value: 'clasico', label: 'Clásico', hint: 'Franja de color con confeti' },
  { value: 'postal', label: 'Postal', hint: 'Papel, fotos tipo polaroid y firma a mano' },
  { value: 'nocturno', label: 'Nocturno', hint: 'Fondo oscuro con brillo de color' },
];

export function isThanksStyle(value: unknown): value is ThanksStyle {
  return THANKS_STYLES.some((s) => s.value === value);
}

export interface ThanksMessages {
  enabled: boolean;
  style: ThanksStyle;
  kicker: string;
  title: string;
  message: string;
  signature: string;
  buttonText: string;
  closeText: string;
}

export const DEFAULT_THANKS_MESSAGES: ThanksMessages = {
  enabled: true,
  style: 'clasico',
  kicker: 'Pedido {pedido} · entregado',
  title: '¡Gracias por tu compra, {nombre}!',
  message:
    'Tu pedido llegó a su destino. Lo preparamos con mucho cuidado y esperamos que lo disfrutes tanto como nosotros disfrutamos hacerlo.',
  signature: 'Con cariño, el equipo de la tienda ♥',
  buttonText: 'Volver a comprar',
  closeText: 'Cerrar',
};

/** Campos de texto de la tarjeta (todos menos el interruptor y el estilo). */
export type ThanksTextKey = Exclude<keyof ThanksMessages, 'enabled' | 'style'>;

/** Fuente manuscrita de la firma en el estilo Postal (se carga una sola vez). */
export function loadThanksFonts(): void {
  if (typeof document === 'undefined' || document.getElementById('thanks-fonts')) return;
  const link = document.createElement('link');
  link.id = 'thanks-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap';
  document.head.appendChild(link);
}

export const THANKS_MAX_LENGTH = { kicker: 80, title: 120, message: 600, signature: 120, buttonText: 40, closeText: 30 };

/**
 * Reemplaza los marcadores. Sin nombre, "{nombre}" desaparece junto con la
 * coma o el espacio que lo precede ("¡Gracias por tu compra!").
 */
export function fillThanks(text: string, name: string, orderCode: string): string {
  return (text || '')
    .replace(/([,\s]*)\{nombre\}/gi, (_m, sep: string) => (name ? `${sep}${name}` : ''))
    .replace(/\{pedido\}/gi, orderCode || '');
}
