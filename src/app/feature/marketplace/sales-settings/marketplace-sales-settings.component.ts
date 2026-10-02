import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { splitPlanLabel } from '../order-tracking/order-labels';
import { DEFAULT_THANKS_MESSAGES, THANKS_MAX_LENGTH, ThanksMessages, fillThanks } from '../order-tracking/thanks-messages';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Configuración de ventas del MarketPlace (modo administrador): formas de pago
 * que ofrece la tienda, pedidos programados (horario de entregas y franjas) y
 * los textos del agradecimiento al entregar el pedido.
 * El backend normaliza y valida los rangos (payment-plans.ts / scheduling.ts).
 */
@Component({
  selector: 'app-marketplace-sales-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marketplace-sales-settings.component.html',
  styleUrls: ['./marketplace-sales-settings.component.css'],
})
export class MarketplaceSalesSettingsComponent implements OnChanges {
  @Input() tenantId = '';

  payments: any = null;
  scheduling: any = null;
  savingPayments = false;
  savingScheduling = false;
  thanks: ThanksMessages | null = null;
  savingThanks = false;
  maxLen = THANKS_MAX_LENGTH;
  tagName = '{nombre}';
  tagOrder = '{pedido}';
  /** Datos de ejemplo para la vista previa. */
  previewName = 'Laura';
  previewCode = 'P-00042';
  open: 'payments' | 'scheduling' | 'thanks' | null = null;
  days = DAYS;
  splitPlanLabel = splitPlanLabel;

  private base = `${environment.apiUrl}/marketplace-config`;

  constructor(private http: HttpClient) {}

  ngOnChanges(): void {
    if (!this.tenantId) return;
    this.http.get<any>(`${this.base}/${this.tenantId}/payment-options`).subscribe({ next: (p) => (this.payments = p), error: () => {} });
    this.http.get<any>(`${this.base}/${this.tenantId}/scheduling`).subscribe({ next: (s) => (this.scheduling = s), error: () => {} });
    this.http.get<ThanksMessages>(`${this.base}/${this.tenantId}/thanks-messages`).subscribe({
      next: (t) => (this.thanks = { ...DEFAULT_THANKS_MESSAGES, ...t }),
      error: () => (this.thanks = { ...DEFAULT_THANKS_MESSAGES }),
    });
  }

  toggle(section: 'payments' | 'scheduling' | 'thanks'): void {
    this.open = this.open === section ? null : section;
  }

  get enabledPlansCount(): number {
    const p = this.payments;
    if (!p) return 0;
    return ['contado', 'contraEntrega', 'mitadMitad', 'planSepare', 'credito'].filter((k) => p[k]?.enabled).length;
  }

  savePayments(): void {
    if (!this.enabledPlansCount) {
      Swal.fire({ icon: 'warning', title: 'Activa al menos una forma de pago', text: 'Sin formas de pago los clientes no podrán hacer pedidos.' });
      return;
    }
    this.savingPayments = true;
    this.http.patch<any>(`${this.base}/${this.tenantId}/payment-options`, this.payments).subscribe({
      next: (saved) => {
        this.payments = saved;
        this.savingPayments = false;
        Swal.fire({ icon: 'success', title: 'Formas de pago guardadas', timer: 1500, showConfirmButton: false });
      },
      error: (err) => {
        this.savingPayments = false;
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err?.error?.message || 'Intenta de nuevo.' });
      },
    });
  }

  saveScheduling(): void {
    this.savingScheduling = true;
    this.http.patch<any>(`${this.base}/${this.tenantId}/scheduling`, this.scheduling).subscribe({
      next: (saved) => {
        this.scheduling = saved;
        this.savingScheduling = false;
        Swal.fire({ icon: 'success', title: 'Programación guardada', timer: 1500, showConfirmButton: false });
      },
      error: (err) => {
        this.savingScheduling = false;
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err?.error?.message || 'Intenta de nuevo.' });
      },
    });
  }

  /** Vista previa con un cliente de ejemplo. */
  preview(key: Exclude<keyof ThanksMessages, 'enabled'>): string {
    const value = this.thanks?.[key]?.trim() || DEFAULT_THANKS_MESSAGES[key];
    return fillThanks(value, this.previewName, this.previewCode);
  }

  resetThanks(): void {
    if (!this.thanks) return;
    this.thanks = { ...DEFAULT_THANKS_MESSAGES, enabled: this.thanks.enabled };
  }

  saveThanks(): void {
    if (!this.thanks) return;
    this.savingThanks = true;
    this.http.patch<ThanksMessages>(`${this.base}/${this.tenantId}/thanks-messages`, this.thanks).subscribe({
      next: (saved) => {
        this.thanks = saved;
        this.savingThanks = false;
        Swal.fire({ icon: 'success', title: 'Mensaje de agradecimiento guardado', timer: 1500, showConfirmButton: false });
      },
      error: (err) => {
        this.savingThanks = false;
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err?.error?.message || 'Intenta de nuevo.' });
      },
    });
  }
}
