import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OnlinePaymentsService, OrderOnlinePayment } from '../../../shared/services/online-payments.service';
import { formatCop } from '../../../shared/utils/currency.util';

/**
 * "Pagar con Mercado Pago" para un pedido de la tienda: solo aparece si la
 * tienda tiene su cuenta conectada y el pedido tiene algo por pagar (lo que
 * falta del anticipo o el saldo). Mientras los pagos en línea estén en
 * configuración no muestra nada: el cliente paga como siempre.
 */
@Component({
  selector: 'app-pay-online-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="po" *ngIf="info?.available">
      <button type="button" class="po-btn" [disabled]="going" (click)="pay()">
        {{ going ? 'Abriendo Mercado Pago…' : 'Pagar ' + money(info!.amount) + ' con Mercado Pago' }}
      </button>
      <small class="po-hint">Tarjeta, PSE o efectivo. El pago se confirma solo, sin subir comprobante.</small>
      <small class="po-error" *ngIf="error">{{ error }}</small>
      <p class="po-or">o paga por transferencia y sube el comprobante:</p>
    </div>
  `,
  styles: [`
    .po { margin: 0.6rem 0; display: grid; gap: 0.3rem; }
    .po-btn { border: 0; border-radius: 10px; padding: 0.75rem 1rem; font-size: 0.95rem; font-weight: 700; background: #009ee3; color: #fff; cursor: pointer; }
    .po-btn:disabled { opacity: 0.65; cursor: default; }
    .po-hint { color: #6b7280; font-size: 0.78rem; text-align: center; }
    .po-error { color: #b91c1c; font-size: 0.8rem; text-align: center; }
    .po-or { margin: 0.4rem 0 0; font-size: 0.8rem; color: #6b7280; text-align: center; }
  `],
})
export class PayOnlineButtonComponent implements OnChanges {
  @Input() token = '';
  /** Cambia cuando el pedido cambia (p. ej. después de un pago) para volver a consultar. */
  @Input() refreshKey: unknown = null;

  info: OrderOnlinePayment | null = null;
  going = false;
  error = '';
  money = formatCop;

  constructor(private api: OnlinePaymentsService) {}

  ngOnChanges(): void {
    if (!this.token) return;
    this.api.orderStatus(this.token).subscribe((i) => (this.info = i));
  }

  pay(): void {
    this.going = true;
    this.error = '';
    this.api.checkout(this.token).subscribe({
      next: ({ url }) => (window.location.href = url),
      error: (e) => {
        this.going = false;
        this.error = e?.error?.message || 'No se pudo abrir el pago en línea. Intenta de nuevo.';
      },
    });
  }
}
