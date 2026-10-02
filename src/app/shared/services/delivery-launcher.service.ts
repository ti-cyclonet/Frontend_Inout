import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Datos con los que se precarga una nueva solicitud de domicilio en Shotra. */
export interface DeliveryPrefill {
  title: string;
  description: string;
  address?: string;
  /** Pedido de InOut que se entrega con este domicilio (avanza solo con el contrato de Shotra). */
  orderId?: string;
}

/**
 * Permite abrir el panel de Domicilios (Shotra, <app-delivery-request> en el
 * layout) desde cualquier módulo, con el formulario de nueva solicitud ya
 * diligenciado — p. ej. desde Pedidos, al pasar un pedido a Entregado.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryLauncherService {
  private openRequestSubject = new Subject<DeliveryPrefill>();
  readonly openRequest$ = this.openRequestSubject.asObservable();

  openNewRequest(prefill: DeliveryPrefill): void {
    this.openRequestSubject.next(prefill);
  }

  /** Avisa a Pedidos que un pedido cambió por Shotra (quedó ligado o avanzó). */
  private ordersChangedSubject = new Subject<void>();
  readonly ordersChanged$ = this.ordersChangedSubject.asObservable();

  notifyOrdersChanged(): void {
    this.ordersChangedSubject.next();
  }
}
