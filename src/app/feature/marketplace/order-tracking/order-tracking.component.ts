import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { PaymentVoucherUploadComponent } from './payment-voucher-upload.component';
import { PAYMENT_PLAN_LABELS, PAYMENT_STATUS_LABELS, ORDER_STATUS_LABELS, formatScheduleRange, planLabel } from './order-labels';

/** Cada cuánto se refresca el seguimiento mientras el pedido sigue en curso. */
const REFRESH_MS = 60_000;
const FINAL = ['DELIVERED', 'INVOICED', 'CANCELLED'];

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
export class OrderTrackingComponent implements OnInit, OnDestroy {
  token = '';
  storeId = '';
  order: any = null;
  loading = true;
  notFound = false;

  planLabels = PAYMENT_PLAN_LABELS;
  planLabel = planLabel;
  paymentStatusLabels = PAYMENT_STATUS_LABELS;
  statusLabels = ORDER_STATUS_LABELS;
  steps = ['CONFIRMED', 'IN_PRODUCTION', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  lastUpdated: Date | null = null;
  /** Reloj para "actualizado hace…" (cada 15 s). */
  now = Date.now();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private onVisible = () => { if (document.visibilityState === 'visible' && !this.isFinal) this.load(true); };

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.storeId = this.route.snapshot.paramMap.get('tenantId') || '';
    this.load();
    if (typeof window === 'undefined') return;
    // Si el cliente deja la página abierta, ve los cambios de estado solos
    this.refreshTimer = setInterval(() => { if (!this.isFinal) this.load(true); }, REFRESH_MS);
    this.clockTimer = setInterval(() => { this.now = Date.now(); }, 15_000);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisible);
  }

  /** silent: refresco automático, sin pantalla de carga ni perder lo que se ve. */
  load(silent = false): void {
    if (!silent) this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/orders/marketplace/track/${this.token}`).subscribe({
      next: (order) => {
        this.order = order;
        this.loading = false;
        this.lastUpdated = new Date();
        this.now = Date.now();
        if (this.isFinal && this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
      },
      error: () => { if (!silent) { this.notFound = true; this.loading = false; } },
    });
  }

  get isFinal(): boolean {
    return !!this.order && FINAL.includes(this.order.status);
  }

  /** "Hoy ~3:30 p. m." / "mañana ~10:00 a. m." / programada con su franja. */
  deliveryText(): string | null {
    const d = this.order?.estimatedDelivery;
    if (!d?.at || this.isFinal) return null;
    const at = new Date(d.at);
    const day = this.relativeDay(at);
    const time = (x: Date) => x.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    if (d.scheduled) return `${day}, ${time(at)}${d.end ? ' – ' + time(new Date(d.end)) : ''}`;
    return `${day} ~${time(at)}`;
  }

  updatedAgo(): string {
    if (!this.lastUpdated) return '';
    const s = Math.max(0, Math.round((this.now - this.lastUpdated.getTime()) / 1000));
    return s < 60 ? 'hace un momento' : `hace ${Math.round(s / 60)} min`;
  }

  private relativeDay(d: Date): string {
    const key = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);
    if (key(d) === key(today)) return 'Hoy';
    if (key(d) === key(tomorrow)) return 'Mañana';
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
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
