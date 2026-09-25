import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Datos con los que se precarga una nueva solicitud de domicilio en Shotra. */
export interface DeliveryPrefill {
  title: string;
  description: string;
  address?: string;
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
}
