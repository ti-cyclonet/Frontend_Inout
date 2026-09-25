import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Preferencias de interfaz del usuario, persistidas en localStorage (por
 * dispositivo). No son parámetros de negocio; son ajustes de visualización.
 */
@Injectable({ providedIn: 'root' })
export class UiPrefsService {
  private static readonly DELIVERY_FAB_KEY = 'inout_show_delivery_fab';
  private static readonly DELIVERY_SUGGEST_KEY = 'inout_suggest_delivery_on_deliver';

  // Visibilidad del botón flotante "Domicilios" (Shotra). Por defecto: visible.
  private showDeliveryFabSubject = new BehaviorSubject<boolean>(this.readDeliveryFab());
  /** Observable reactivo para que el FAB aparezca/desaparezca al instante. */
  showDeliveryFab$ = this.showDeliveryFabSubject.asObservable();

  private readDeliveryFab(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    const v = localStorage.getItem(UiPrefsService.DELIVERY_FAB_KEY);
    // Ausente = visible por defecto; solo se oculta si explícitamente es 'false'.
    return v === null ? true : v === 'true';
  }

  getShowDeliveryFab(): boolean {
    return this.showDeliveryFabSubject.value;
  }

  setShowDeliveryFab(show: boolean): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(UiPrefsService.DELIVERY_FAB_KEY, String(show));
    }
    this.showDeliveryFabSubject.next(show);
  }

  /**
   * Sugerir contratar un domiciliario en Shotra al pasar un pedido a
   * Entregado. Por defecto: sí. Se apaga con "No volver a mostrar" en la
   * sugerencia y se reactiva en Configuración.
   */
  getSuggestDeliveryOnDeliver(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    const v = localStorage.getItem(UiPrefsService.DELIVERY_SUGGEST_KEY);
    return v === null ? true : v === 'true';
  }

  setSuggestDeliveryOnDeliver(show: boolean): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(UiPrefsService.DELIVERY_SUGGEST_KEY, String(show));
    }
  }
}
