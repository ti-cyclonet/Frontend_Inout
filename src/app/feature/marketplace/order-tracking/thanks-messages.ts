/**
 * Textos de la modal de agradecimiento al entregar el pedido. La tienda los
 * cambia en el MarketPlace (modo administrador); el backend los normaliza
 * (Backend_Inout/src/orders/thanks-messages.ts, mismos valores por defecto).
 *
 * Marcadores: {nombre} = primer nombre del cliente, {pedido} = código del pedido.
 */
export interface ThanksMessages {
  enabled: boolean;
  kicker: string;
  title: string;
  message: string;
  signature: string;
  buttonText: string;
  closeText: string;
}

export const DEFAULT_THANKS_MESSAGES: ThanksMessages = {
  enabled: true,
  kicker: 'Pedido {pedido} · entregado',
  title: '¡Gracias por tu compra, {nombre}!',
  message:
    'Tu pedido llegó a su destino. Lo preparamos con mucho cuidado y esperamos que lo disfrutes tanto como nosotros disfrutamos hacerlo.',
  signature: 'Con cariño, el equipo de la tienda ♥',
  buttonText: 'Volver a comprar',
  closeText: 'Cerrar',
};

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
