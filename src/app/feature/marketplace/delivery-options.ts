/**
 * Formas de entrega de la tienda (marketplace-config/:tenantId/delivery-options).
 * El backend las normaliza y calcula el valor del domicilio de cada pedido
 * (Backend_Inout/src/orders/delivery-options.ts, mismos campos).
 */
/** Sitio de entrega con su valor ("Turbaco", 5000). */
export interface DeliveryZone {
  name: string;
  fee: number;
}

export interface DeliveryOptions {
  /** La tienda entrega a domicilio. */
  deliveryEnabled: boolean;
  /** Valor del domicilio en pesos (0 = gratis). Con zonas: el de "otra zona". */
  deliveryFee: number;
  /** Zonas de entrega con su valor; vacío = el mismo valor en todas partes. */
  zones: DeliveryZone[];
  /** Con zonas: acepta direcciones fuera de la lista, por deliveryFee. */
  otherZones: boolean;
  /** El cliente puede recoger en el local. */
  pickupEnabled: boolean;
  pickupAddress: string;
  pickupNotes: string;
}

/** Lo que se envía como zona cuando la dirección no está en la lista. */
export const OTHER_ZONE = '__other__';
export const DELIVERY_ZONE_LIMITS = { zones: 50, name: 60 };

export const DEFAULT_DELIVERY_OPTIONS: DeliveryOptions = {
  deliveryEnabled: true,
  deliveryFee: 0,
  zones: [],
  otherZones: true,
  pickupEnabled: false,
  pickupAddress: '',
  pickupNotes: '',
};
