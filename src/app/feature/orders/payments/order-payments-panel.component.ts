import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { PAYMENT_PLAN_LABELS, PAYMENT_STATUS_LABELS, planLabel } from '../../marketplace/order-tracking/order-labels';
import { formatCop } from '../../../shared/utils/currency.util';

interface OrderPayment {
  id: string;
  amount: number | string;
  method: string;
  reference: string | null;
  voucherUrl: string | null;
  source: 'CLIENTE' | 'NEGOCIO';
  status: 'PENDIENTE_VERIFICACION' | 'VERIFICADO' | 'RECHAZADO';
  notes: string | null;
  rejectReason: string | null;
  createdAt: string;
}

const METHODS: Record<string, string> = {
  EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta', NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', OTRO: 'Otro',
};

/**
 * Pagos de un pedido en el panel: resumen (plan, pagado, saldo, plazos),
 * comprobantes que subió el cliente para verificar o rechazar, y registro de
 * pagos recibidos por el negocio.
 */
@Component({
  selector: 'app-order-payments-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-payments-panel.component.html',
  styleUrls: ['./order-payments-panel.component.css'],
})
export class OrderPaymentsPanelComponent implements OnChanges {
  @Input() order: any;
  /** Se emite tras verificar, rechazar o registrar un pago (el pedido cambió). */
  @Output() changed = new EventEmitter<void>();

  payments: OrderPayment[] = [];
  loading = false;
  planLabels = PAYMENT_PLAN_LABELS;
  planLabel = planLabel;
  statusLabels = PAYMENT_STATUS_LABELS;
  methods = METHODS;

  private base = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {}

  ngOnChanges(): void {
    if (this.order?.id) this.load();
  }

  load(): void {
    this.loading = true;
    this.http.get<OrderPayment[]>(`${this.base}/${this.order.id}/payments`).subscribe({
      next: (p) => { this.payments = p || []; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get balance(): number {
    return Math.max(0, Number(this.order?.total || 0) - Number(this.order?.amountPaid || 0));
  }

  get acceptsPayments(): boolean {
    return !!this.order && this.order.paymentPlan !== 'CREDITO' && !['CANCELLED', 'INVOICED'].includes(this.order.status) && this.balance > 0;
  }

  get depositMissing(): number {
    return Math.max(0, Number(this.order?.depositRequired || 0) - Number(this.order?.amountPaid || 0));
  }

  verify(p: OrderPayment): void {
    Swal.fire({
      icon: 'question',
      title: 'Confirmar pago',
      html: `¿Recibiste <strong>${this.formatCurrency(Number(p.amount))}</strong> por ${this.methods[p.method] || p.method}?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
    }).then((r) => r.isConfirmed && this.review(p, 'VERIFY'));
  }

  reject(p: OrderPayment): void {
    Swal.fire({
      icon: 'warning',
      title: 'Rechazar comprobante',
      input: 'text',
      inputLabel: 'Motivo (lo verá el cliente)',
      inputPlaceholder: 'Ej: el valor no coincide con la transferencia',
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar',
      inputValidator: (v) => (!v || v.trim().length < 5 ? 'Escribe el motivo (mínimo 5 caracteres).' : null),
    }).then((r) => r.isConfirmed && this.review(p, 'REJECT', r.value));
  }

  private review(p: OrderPayment, action: 'VERIFY' | 'REJECT', reason?: string): void {
    this.http.patch(`${this.base}/${this.order.id}/payments/${p.id}`, { action, reason }).subscribe({
      next: () => { this.load(); this.changed.emit(); },
      error: (err) => Swal.fire({ icon: 'error', title: 'No se pudo', text: this.errorText(err) }),
    });
  }

  register(): void {
    const suggested = this.depositMissing > 0 ? this.depositMissing : this.balance;
    const options = Object.entries(this.methods).map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    Swal.fire({
      title: 'Registrar pago',
      html: `
        <div style="text-align:left;font-size:0.9rem">
          <label>Valor</label>
          <input id="op-amount" type="number" min="1" class="swal2-input" style="margin:4px 0 10px;width:100%" value="${Math.round(suggested)}">
          <label>Medio</label>
          <select id="op-method" class="swal2-select" style="margin:4px 0 10px;width:100%">${options}</select>
          <label>Referencia (opcional)</label>
          <input id="op-ref" type="text" maxlength="100" class="swal2-input" style="margin:4px 0;width:100%">
          <small>Saldo pendiente: ${this.formatCurrency(this.balance)}</small>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Registrar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const amount = Number((document.getElementById('op-amount') as HTMLInputElement).value);
        const method = (document.getElementById('op-method') as HTMLSelectElement).value;
        const reference = (document.getElementById('op-ref') as HTMLInputElement).value.trim();
        if (!amount || amount <= 0) { Swal.showValidationMessage('Indica el valor del pago.'); return false; }
        if (amount > this.balance) { Swal.showValidationMessage('El pago supera el saldo pendiente.'); return false; }
        return { amount, method, ...(reference ? { reference } : {}) };
      },
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.http.post(`${this.base}/${this.order.id}/payments`, r.value).subscribe({
        next: () => { this.load(); this.changed.emit(); },
        error: (err) => Swal.fire({ icon: 'error', title: 'No se pudo registrar', text: this.errorText(err) }),
      });
    });
  }

  /** Formato de pesos de los pedidos: "$2.362.200". */
  formatCurrency(value: number): string {
    return formatCop(value);
  }

  formatDate(iso: string): string {
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    return iso.length === 10
      ? d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
      : d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  private errorText(err: any): string {
    const m = err?.error?.message;
    return Array.isArray(m) ? m[0] : m || 'Intenta de nuevo.';
  }
}
