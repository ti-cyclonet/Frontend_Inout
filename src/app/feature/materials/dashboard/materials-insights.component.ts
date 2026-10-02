import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { LivePanel } from '../../../shared/components/panel-kit/live-panel';
import { PANEL_KIT, PkAttention, PkBar, PkRow } from '../../../shared/components/panel-kit/panel-kit.components';

interface MaterialsPanel {
  kpis: {
    materials: number; composites: number; resale: number; value: number; compositesValue: number;
    lowStock: number; outOfStock: number; healthPercent: number | null;
    consumption30: number; purchasesMonth: number; purchasesPrevMonth: number; idle30: number;
  };
  alerts: {
    lowStock: { id: string; name: string; stock: number; min: number; unit: string }[];
    outOfStock: { id: string; name: string; unit: string }[];
    expiringLots: { id: string; name: string; daysLeft: number }[];
    idle: { id: string; name: string; value: number }[];
  };
  topConsumed: { name: string; quantity: number; value: number; unit: string }[];
  topValue: { name: string; value: number }[];
  activity: { id: string; type: string; reason: string; name: string; quantity: number; unit: string; at: string }[];
}

const REASONS: Record<string, string> = {
  PURCHASE: 'Compra', PRODUCTION: 'Producción', ADJUSTMENT: 'Ajuste', OPENING_BALANCE: 'Saldo inicial', TRANSFORMED_MATERIAL: 'Material compuesto', SALE: 'Venta',
  TRANSFER: 'Traslado', COUNT: 'Conteo físico', RETURN: 'Devolución',
};

/** Indicadores del panel de Materiales (GET /dashboard/materials), en vivo. */
@Component({
  selector: 'app-materials-insights',
  standalone: true,
  imports: [CommonModule, ...PANEL_KIT],
  template: `
    <section class="pk">
      <div class="pk-head">
        <div><h2>Tus materiales hoy</h2><p>Stock, consumo de los últimos 30 días y compras del mes</p></div>
        <app-pk-live *ngIf="!loading" [updatedAt]="lastUpdated" [stale]="stale" [refreshing]="refreshing" (refresh)="refresh()"></app-pk-live>
      </div>

      <div class="pk-grid" *ngIf="loading"><div class="pk-skeleton" *ngFor="let i of [1, 2, 3, 4]"></div></div>
      <div class="pk-error" *ngIf="error && !loading">{{ error }}</div>

      <ng-container *ngIf="data as d">
        <div class="pk-grid">
          <app-pk-kpi icon="cash-stack" tone="violet" label="Valor del inventario" [value]="compactMoney(d.kpis.value)" [title]="money(d.kpis.value)">
            <span>{{ d.kpis.materials }} materiales · compuestos {{ compactMoney(d.kpis.compositesValue) }}</span>
          </app-pk-kpi>
          <app-pk-kpi icon="exclamation-triangle" tone="orange" label="Por reponer" [value]="d.kpis.lowStock" [alert]="d.kpis.outOfStock > 0">
            <span class="pk-chip" [class.danger]="d.kpis.outOfStock" [class.ok]="!d.kpis.outOfStock">{{ d.kpis.outOfStock ? d.kpis.outOfStock + ' agotado(s)' : 'Nada agotado' }}</span>
            <span>bajo el mínimo</span>
          </app-pk-kpi>
          <app-pk-kpi icon="box-arrow-up-right" tone="blue" label="Consumo · 30 días" [value]="compactMoney(d.kpis.consumption30)" [title]="money(d.kpis.consumption30)">
            <span>salidas por producción y ventas</span>
          </app-pk-kpi>
          <app-pk-kpi icon="bag-plus" tone="green" label="Compras del mes" [value]="compactMoney(d.kpis.purchasesMonth)" [title]="money(d.kpis.purchasesMonth)">
            <app-pk-delta [value]="delta(d.kpis.purchasesMonth, d.kpis.purchasesPrevMonth)"></app-pk-delta><span>vs. mes anterior</span>
          </app-pk-kpi>
        </div>

        <div class="pk-grid">
          <app-pk-mini [ring]="d.kpis.healthPercent" title="Salud del stock" [sub]="d.kpis.lowStock + ' bajo el mínimo'"></app-pk-mini>
          <app-pk-mini icon="diagram-3" tone="violet" [title]="d.kpis.composites + ' compuestos'" sub="Materiales transformados"></app-pk-mini>
          <app-pk-mini icon="arrow-repeat" tone="green" [title]="d.kpis.resale + ' de reventa'" sub="Se venden sin transformar"></app-pk-mini>
          <app-pk-mini icon="hourglass-bottom" tone="gray" [title]="d.kpis.idle30 + ' sin movimiento'" sub="Con stock, sin uso en 30 días"></app-pk-mini>
        </div>

        <div class="pk-row">
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Requiere atención</h3><span class="pk-count" *ngIf="attention.length">{{ attention.length }}</span></header>
            <app-pk-attention [items]="attention" [rows]="rows" emptyText="Ningún material agotado, bajo el mínimo ni por vencer."></app-pk-attention>
          </article>
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Más consumidos</h3><small>Últimos 30 días, por valor</small></header>
            <app-pk-bars [items]="consumed" tone="blue" emptyText="Sin consumos en los últimos 30 días."></app-pk-bars>
          </article>
        </div>

        <div class="pk-row half">
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Donde está tu dinero</h3><small>Materiales con más valor en stock</small></header>
            <app-pk-bars [items]="byValue" tone="violet" emptyText="Aún no hay stock."></app-pk-bars>
          </article>
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Últimos movimientos</h3><small>Entradas y salidas</small></header>
            <ul class="pk-feed" style="grid-template-columns: 1fr" *ngIf="d.activity.length; else noMoves">
              <li *ngFor="let a of d.activity; trackBy: byId">
                <span class="fi" [class.in]="a.type === 'IN'" [class.out]="a.type === 'OUT'">
                  <svg viewBox="0 0 16 16"><use [attr.xlink:href]="'./assets/icons/bootstrap-icons.svg#' + (a.type === 'IN' ? 'box-arrow-in-down' : 'box-arrow-up')"/></svg>
                </span>
                <span class="fb"><strong>{{ a.name }}</strong><small>{{ a.type === 'IN' ? 'Entrada' : 'Salida' }} · {{ reason(a.reason) }} · {{ a.quantity }} {{ a.unit }}</small></span>
                <time>{{ relativeTime(a.at) }}</time>
              </li>
            </ul>
            <ng-template #noMoves><p class="pk-empty">Sin movimientos en los últimos 30 días.</p></ng-template>
          </article>
        </div>
      </ng-container>
    </section>`,
})
export class MaterialsInsightsComponent extends LivePanel<MaterialsPanel> implements OnChanges {
  /** Cambiarlo recarga (p. ej. después de una importación masiva). */
  @Input() refreshKey = 0;

  attention: PkAttention[] = [];
  rows: PkRow[] = [];
  consumed: PkBar[] = [];
  byValue: PkBar[] = [];
  private http = inject(HttpClient);

  protected fetch() {
    return this.http.get<MaterialsPanel>(`${environment.apiUrl}/dashboard/materials`);
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['refreshKey'] && !c['refreshKey'].firstChange) this.refresh();
  }

  protected override onData(d: MaterialsPanel): void {
    const a: PkAttention[] = [];
    if (d.kpis.outOfStock) a.push({ icon: 'x-octagon-fill', tone: 'danger', count: d.kpis.outOfStock, label: 'Materiales agotados', detail: 'Sin stock disponible para producir', link: '/kardex' });
    if (d.kpis.lowStock) a.push({ icon: 'exclamation-triangle-fill', tone: 'warning', count: d.kpis.lowStock, label: 'Bajo el mínimo', detail: 'Programa la compra antes de quedarte sin stock', link: '/kardex' });
    if (d.alerts.expiringLots.length) a.push({ icon: 'hourglass-split', tone: 'warning', count: d.alerts.expiringLots.length, label: 'Lotes por vencer (15 días)', detail: `El más próximo en ${d.alerts.expiringLots[0].daysLeft} día(s)`, link: '/kardex' });
    if (d.kpis.idle30) a.push({ icon: 'hourglass-bottom', tone: 'info', count: d.kpis.idle30, label: 'Sin movimiento (30 días)', detail: 'Capital quieto: revisa si vale la pena seguir comprándolos', link: '/inventory' });
    this.attention = a;
    this.rows = [
      ...d.alerts.outOfStock.map((m) => ({ tone: 'danger' as const, main: m.name, meta: 'agotado' })),
      ...d.alerts.lowStock.map((m) => ({ tone: 'warning' as const, main: m.name, meta: `${m.stock} ${m.unit} de mín. ${m.min}` })),
      ...d.alerts.expiringLots.map((l) => ({ tone: 'warning' as const, main: l.name, meta: `vence en ${l.daysLeft} d` })),
      ...d.alerts.idle.map((m) => ({ tone: 'info' as const, main: m.name, meta: `${this.compactMoney(m.value)} quietos` })),
    ].slice(0, 8);
    this.consumed = this.withShare(d.topConsumed).map((c) => ({ ...c, label: this.compactMoney(c.value), sub: `${Math.round(c.quantity * 100) / 100} ${c.unit}` }));
    this.byValue = this.withShare(d.topValue).map((c) => ({ ...c, label: this.compactMoney(c.value) }));
  }

  reason(r: string): string { return REASONS[r] || r || 'Movimiento'; }
  byId = (_: number, a: { id: string }) => a.id;
}
