import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { PaymentVoucherUploadComponent } from './payment-voucher-upload.component';
import { PAYMENT_PLAN_LABELS, PAYMENT_STATUS_LABELS, ORDER_STATUS_LABELS, formatScheduleRange } from './order-labels';

/**
 * Seguimiento público de un pedido del MarketPlace: /marketplace/:tenantId/pedido/:token.
 * El token llega con el pedido; sirve también a invitados sin cuenta para ver
 * el estado, los pagos y subir comprobantes.
 */
@Component({
  selector: 'app-order-tracking',
  standalone: true,
  imports: [CommonModule, RouterModule, PaymentVoucherUploadComponent],
  templateUrl: './order-tracking.component.html',
  styleUrls: ['./order-tracking.component.css'],
})
export class OrderTrackingComponent implements OnInit {
  token = '';
  storeId = '';
  order: any = null;
  loading = true;
  notFound = false;

  planLabels = PAYMENT_PLAN_LABELS;
  paymentStatusLabels = PAYMENT_STATUS_LABELS;
  statusLabels = ORDER_STATUS_LABELS;
  steps = ['CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED'];

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.storeId = this.route.snapshot.paramMap.get('tenantId') || '';
    this.load();
  }

  load(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/orders/marketplace/track/${this.token}`).subscribe({
      next: (order) => { this.order = order; this.loading = false; },
      error: () => { this.notFound = true; this.loading = false; },
    });
  }

  get stepIndex(): number {
    const s = this.order?.status === 'INVOICED' ? 'DELIVERED' : this.order?.status;
    return this.steps.indexOf(s);
  }

  /** ¿Tiene sentido pedirle un comprobante? (hay saldo y el pedido sigue vivo) */
  get canUploadVoucher(): boolean {
    const o = this.order;
    return !!o && o.balanceDue > 0 && o.paymentPlan && o.paymentPlan !== 'CREDITO'
      && !['CANCELLED', 'INVOICED'].includes(o.status);
  }

  /** Monto sugerido: lo que falta del anticipo o, si ya está cubierto, el saldo. */
  get suggestedAmount(): number {
    const o = this.order;
    if (!o) return 0;
    const pendingVouchers = (o.payments || [])
      .filter((p: any) => p.status === 'PENDIENTE_VERIFICACION')
      .reduce((s: number, p: any) => s + p.amount, 0);
    const missingDeposit = Math.max(0, o.depositRequired - o.amountPaid - pendingVouchers);
    return missingDeposit > 0 ? missingDeposit : Math.max(0, o.balanceDue - pendingVouchers);
  }

  hasToManufacture(): boolean {
    return (this.order?.items || []).some((i: any) => i.toManufacture > 0);
  }

  schedule(): string | null {
    return this.order?.scheduledStart ? formatScheduleRange(this.order.scheduledStart, this.order.scheduledEnd) : null;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0);
  }

  formatDate(iso: string | null, withTime = false): string {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    return withTime
      ? d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
