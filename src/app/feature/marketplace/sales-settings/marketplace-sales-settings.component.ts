import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Configuración de ventas del MarketPlace (modo administrador): formas de pago
 * que ofrece la tienda y pedidos programados (horario de entregas y franjas).
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
  open: 'payments' | 'scheduling' | null = null;
  days = DAYS;

  private base = `${environment.apiUrl}/marketplace-config`;

  constructor(private http: HttpClient) {}

  ngOnChanges(): void {
    if (!this.tenantId) return;
    this.http.get<any>(`${this.base}/${this.tenantId}/payment-options`).subscribe({ next: (p) => (this.payments = p), error: () => {} });
    this.http.get<any>(`${this.base}/${this.tenantId}/scheduling`).subscribe({ next: (s) => (this.scheduling = s), error: () => {} });
  }

  toggle(section: 'payments' | 'scheduling'): void {
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
}
