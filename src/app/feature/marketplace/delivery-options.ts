/**
 * Formas de entrega de la tienda (marketplace-config/:tenantId/delivery-options).
 * El backend las normaliza y calcula el valor del domicilio de cada pedido
 * (Backend_Inout/src/orders/delivery-options.ts, mismos campos).
 */
export interface DeliveryOptions {
  /** La tienda entrega a domicilio. */
  deliveryEnabled: boolean;
  /** Valor del domicilio en pesos (0 = gratis). */
  deliveryFee: number;
  /** El cliente puede recoger en el local. */
  pickupEnabled: boolean;
  pickupAddress: string;
  pickupNotes: string;
}

export const DEFAULT_DELIVERY_OPTIONS: DeliveryOptions = {
  deliveryEnabled: true,
  deliveryFee: 0,
  pickupEnabled: false,
  pickupAddress: '',
  pickupNotes: '',
};
