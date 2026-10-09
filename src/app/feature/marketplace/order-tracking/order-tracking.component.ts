import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { PaymentVoucherUploadComponent } from './payment-voucher-upload.component';
import { PAYMENT_PLAN_LABELS, PAYMENT_STATUS_LABELS, ORDER_STATUS_LABELS, formatScheduleRange, planLabel } from './order-labels';
import { formatCop } from '../../../shared/utils/currency.util';
import { DisplayLine, groupComboLines } from '../../../shared/utils/combo-lines.util';
import { DEFAULT_THANKS_MESSAGES, ThanksStyle, ThanksTextKey, fillThanks, isThanksStyle, loadThanksFonts } from './thanks-messages';

/** Cada cuánto se refresca el seguimiento mientras el pedido sigue en curso. */
const REFRESH_MS = 60_000;
const FINAL = ['DELIVERED', 'INVOICED', 'CANCELLED'];
const DELIVERED = ['DELIVERED', 'INVOICED'];
/** El agradecimiento se muestra una sola vez por pedido (en este navegador). */
const THANKS_KEY = 'inout.thanks.';

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
  /** Modal de agradecimiento al entregarse el pedido. */
  showThanks = false;
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
        this.maybeShowThanks();
        this.lastUpdated = new Date();
        this.now = Date.now();
        if (this.isFinal && this.refreshTimer) { clearInterval(this.refreshTimer); this.refreshTimer = null; }
      },
      error: () => { if (!silent) { this.notFound = true; this.loading = false; } },
    });
  }

  /** Pedido entregado y aún no agradecido en este navegador: se abre la modal. */
  private maybeShowThanks(): void {
    // Sin thanks: la tienda apagó el agradecimiento (o el pedido no se ha entregado)
    if (!this.order?.thanks || !DELIVERED.includes(this.order.status) || this.showThanks) return;
    let seen = false;
    try { seen = localStorage.getItem(THANKS_KEY + this.token) === '1'; } catch { /* sin almacenamiento */ }
    if (!seen) this.openThanks();
  }

  closeThanks(): void {
    this.showThanks = false;
    try { localStorage.setItem(THANKS_KEY + this.token, '1'); } catch { /* sin almacenamiento */ }
  }

  /** Vuelve a abrir el agradecimiento desde la tarjeta del pedido. */
  openThanks(): void {
    if (this.thanksStyle === 'postal') loadThanksFonts();
    this.showThanks = true;
  }

  get isDelivered(): boolean {
    return !!this.order?.thanks && DELIVERED.includes(this.order.status);
  }

  /** Texto de la modal, configurado por la tienda, con sus marcadores reemplazados. */
  thanksText(key: ThanksTextKey): string {
    const messages = this.order?.thanks?.messages || DEFAULT_THANKS_MESSAGES;
    return fillThanks(messages[key] || DEFAULT_THANKS_MESSAGES[key], this.firstName(), this.order?.orderCode || '');
  }

  /** Diseño de la tarjeta elegido por la tienda (clásico si no eligió). */
  get thanksStyle(): ThanksStyle {
    const s = this.order?.thanks?.messages?.style;
    return isThanksStyle(s) ? s : 'clasico';
  }

  /** Color de la tienda para la modal (o el naranja de InOut). */
  get thanksColor(): string {
    const c = this.order?.thanks?.brandColor;
    return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#e65c00';
  }

  get thanksImages(): string[] {
    return (this.order?.thanks?.images || []).slice(0, 4);
  }

  firstName(): string {
    return (this.order?.customerName || '').trim().split(/\s+/)[0] || '';
  }

  /** Imagen rota: se quita del collage. */
  onThanksImageError(url: string): void {
    if (this.order?.thanks?.images) {
      this.order.thanks.images = this.order.thanks.images.filter((u: string) => u !== url);
    }
  }

  get isFinal(): boolean {
    return !!this.order && FINAL.includes(this.order.status);
  }

  /** La franja programada ya pasó y el pedido aún no se entrega. */
  get deliveryLate(): boolean {
    return !!this.order?.estimatedDelivery?.late && !this.isFinal;
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

  /**
   * Sin hora calculable (la tienda no configuró los tiempos de Listo / En
   * reparto), se describe el momento de la entrega en palabras.
   */
  deliveryStatusText(): string | null {
    if (!this.order || this.isFinal || this.deliveryText()) return null;
    const texts: Record<string, string> = {
      CONFIRMED: 'Recibimos tu pedido; pronto empezaremos a prepararlo.',
      IN_PRODUCTION: 'Estamos preparando tu pedido.',
      READY: 'Tu pedido está listo y pronto saldrá a reparto.',
      OUT_FOR_DELIVERY: '¡Tu pedido va en camino!',
    };
    return texts[this.order.status] || null;
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

  /** Ítems para mostrar: cada combo en una sola línea con lo que incluye. */
  get displayItems(): DisplayLine[] {
    return groupComboLines(this.order?.items);
  }

  hasToManufacture(): boolean {
    return (this.order?.items || []).some((i: any) => i.toManufacture > 0);
  }

  schedule(): string | null {
    return this.order?.scheduledStart ? formatScheduleRange(this.order.scheduledStart, this.order.scheduledEnd) : null;
  }

  /** Formato de pesos de los pedidos: "$2.362.200". */
  formatCurrency(value: number): string {
    return formatCop(value);
  }

  formatDate(iso: string | null, withTime = false): string {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    return withTime
      ? d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
