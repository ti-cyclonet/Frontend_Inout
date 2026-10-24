import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface FeaturedPlanOffer { plan: 'WEEK' | 'MONTH'; days: number; price: number; startsAt: string; endsAt: string }
interface FeaturedPurchase {
  id: string; plan: 'WEEK' | 'MONTH'; days: number; price: number; status: 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  startsAt: string; endsAt: string; invoiceCode: string | null; invoiceStatus: string | null;
}
interface FeaturedOffer { enabled: boolean; slots: number; plans: FeaturedPlanOffer[]; mine: FeaturedPurchase[] }

/** Donde se pagan las facturas de CycloNet. */
const FACTONET_URL = environment.production ? 'https://billing.cyclonet.com.co' : 'http://localhost:4202';

const STATUS: Record<FeaturedPurchase['status'], string> = {
  PENDING_PAYMENT: 'Esperando el pago',
  ACTIVE: 'Activo',
  EXPIRED: 'Terminó',
  CANCELLED: 'Sin pagar · cupo liberado',
};

/**
 * "Destacar mi tienda": compra del destacado en CycloNet Market por 7 o 30
 * días. Se emite una factura que se paga en FactoNet; al confirmarse el pago
 * la tienda sale primero en la vitrina, con insignia.
 */
@Component({
  selector: 'app-market-featured',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mf-overlay" (click)="close.emit()">
      <div class="mf-modal" role="dialog" aria-modal="true" aria-labelledby="mf-title" (click)="$event.stopPropagation()">
        <button type="button" class="mf-x" (click)="close.emit()" aria-label="Cerrar">✕</button>
        <h3 id="mf-title">★ Destaca tu tienda en CycloNet Market</h3>
        <p class="mf-lead">Tu tienda sale primero en la vitrina general, con la insignia <b>Destacada</b>, y tus productos encabezan cada vuelta del catálogo. Hay {{ offer?.slots || 0 }} cupos a la vez.</p>

        <p class="mf-muted" *ngIf="loading">Cargando…</p>
        <p class="mf-error" *ngIf="error">{{ error }}</p>

        <ng-container *ngIf="offer && !loading">
          <p class="mf-muted" *ngIf="!offer.enabled">Los destacados no están disponibles por ahora.</p>

          <div class="mf-plans" *ngIf="offer.enabled && !pending">
            <article class="mf-plan" *ngFor="let p of offer.plans" [class.best]="p.plan === 'MONTH'">
              <strong>{{ p.days }} días</strong>
              <span class="mf-price">{{ money(p.price) }}</span>
              <small>{{ startsLabel(p) }}</small>
              <button type="button" class="mf-btn" [disabled]="sending" (click)="buy(p)">{{ sending === p.plan ? 'Emitiendo factura…' : 'Destacar ' + p.days + ' días' }}</button>
            </article>
          </div>

          <div class="mf-pending" *ngIf="pending as m">
            <strong>Factura {{ m.invoiceCode || '' }} por {{ money(m.price) }}</strong>
            <span>Págala en FactoNet. Tu destacado de {{ m.days }} días se activa al confirmarse el pago{{ m.invoiceStatus === 'Payment Reported' ? ' (ya reportaste el pago: lo estamos verificando)' : '' }}.</span>
            <a class="mf-btn" [href]="factonetUrl" target="_blank" rel="noopener">Pagar en FactoNet ↗</a>
          </div>

          <ul class="mf-history" *ngIf="history.length">
            <li *ngFor="let m of history">
              <span>{{ m.days }} días · {{ date(m.startsAt) }} al {{ date(m.endsAt) }}</span>
              <b [class]="'st-' + m.status">{{ statusLabel(m.status) }}</b>
            </li>
          </ul>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .mf-overlay { position: fixed; inset: 0; z-index: 1060; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(15, 23, 42, 0.5); }
    .mf-modal { position: relative; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; padding: 24px; border-radius: 16px; background: #fff; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); }
    .mf-x { position: absolute; top: 10px; right: 12px; border: 0; background: none; font-size: 16px; color: #94a3b8; }
    h3 { margin: 0 0 6px; font-size: 1.15rem; font-weight: 800; color: #0f172a; }
    .mf-lead { margin: 0 0 14px; font-size: 0.9rem; color: #475569; }
    .mf-muted { color: #64748b; font-size: 0.9rem; }
    .mf-error { color: #b91c1c; font-size: 0.9rem; }
    .mf-plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .mf-plan { display: flex; flex-direction: column; gap: 6px; padding: 16px; border: 1.5px solid #e2e8f0; border-radius: 14px; }
    .mf-plan.best { border-color: #f59e0b; background: #fffbeb; }
    .mf-plan strong { font-size: 1rem; color: #0f172a; }
    .mf-price { font-size: 1.4rem; font-weight: 800; color: #b45309; }
    .mf-plan small { color: #64748b; }
    .mf-btn { margin-top: 6px; display: inline-flex; justify-content: center; padding: 9px 14px; border: 0; border-radius: 10px; background: #0b3d91; color: #fff; font-weight: 700; font-size: 0.88rem; text-decoration: none; }
    .mf-btn:disabled { opacity: 0.6; }
    .mf-pending { display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 12px; background: #eff6ff; color: #1e3a8a; font-size: 0.9rem; }
    .mf-pending .mf-btn { align-self: flex-start; }
    .mf-history { list-style: none; padding: 0; margin: 16px 0 0; display: grid; gap: 6px; font-size: 0.85rem; }
    .mf-history li { display: flex; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 8px; background: #f8fafc; }
    .st-ACTIVE { color: #15803d; } .st-PENDING_PAYMENT { color: #1d4ed8; } .st-EXPIRED { color: #64748b; } .st-CANCELLED { color: #b91c1c; }
  `],
})
export class MarketFeaturedComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  readonly factonetUrl = FACTONET_URL;
  offer: FeaturedOffer | null = null;
  loading = true;
  error = '';
  sending: 'WEEK' | 'MONTH' | null = null;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.http.get<FeaturedOffer>(`${environment.apiUrl}/market-featured/offer`).subscribe({
      next: (o) => { this.offer = o; this.loading = false; this.cdr.markForCheck(); },
      error: () => { this.error = 'No pudimos cargar la oferta. Intenta de nuevo.'; this.loading = false; this.cdr.markForCheck(); },
    });
  }

  get pending(): FeaturedPurchase | null {
    return this.offer?.mine.find((m) => m.status === 'PENDING_PAYMENT') || null;
  }

  get history(): FeaturedPurchase[] {
    return (this.offer?.mine || []).filter((m) => m.status !== 'PENDING_PAYMENT').slice(0, 5);
  }

  buy(p: FeaturedPlanOffer): void {
    this.sending = p.plan;
    this.error = '';
    this.http.post(`${environment.apiUrl}/market-featured`, { plan: p.plan }).subscribe({
      next: () => { this.sending = null; this.load(); },
      error: (err) => {
        this.sending = null;
        this.error = err?.status === 403 ? 'Solo un administrador del negocio puede comprar el destacado.' : err?.error?.message || 'No pudimos emitir la factura. Intenta de nuevo.';
        this.cdr.markForCheck();
      },
    });
  }

  startsLabel(p: FeaturedPlanOffer): string {
    const start = new Date(p.startsAt);
    return start.getTime() <= Date.now() + 60_000
      ? `Empieza al confirmar el pago, hasta el ${this.date(new Date(start.getTime() + p.days * 86400000).toISOString())}`
      : `Próximo cupo libre: del ${this.date(p.startsAt)} al ${this.date(p.endsAt)}`;
  }

  statusLabel(s: FeaturedPurchase['status']): string {
    return STATUS[s] || s;
  }

  money(v: number): string {
    return '$' + Math.round(v || 0).toLocaleString('es-CO');
  }

  date(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }
}
