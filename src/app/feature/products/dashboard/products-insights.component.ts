import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { LivePanel } from '../../../shared/components/panel-kit/live-panel';
import { PANEL_KIT, PkAttention, PkBar, PkRow } from '../../../shared/components/panel-kit/panel-kit.components';

interface ProductsPanel {
  kpis: {
    products: number; inMarketplace: number; madeToOrder: number; value: number; avgMargin: number | null;
    unitsSoldMonth: number; revenueMonth: number; producedMonth: number; batchesMonth: number;
    lowStock: number; outOfStock: number; noSales30: number;
  };
  alerts: {
    lowStock: { id: string; name: string; stock: number; min: number }[];
    outOfStock: { id: string; name: string }[];
    lowMargin: { id: string; name: string; margin: number }[];
    noSales: { id: string; name: string }[];
  };
  topSold: { name: string; quantity: number; value: number }[];
  recentProductions: { id: string; name: string; quantity: number; batch: string; at: string }[];
}

/** Indicadores del panel de Productos (GET /dashboard/products), en vivo. */
@Component({
  selector: 'app-products-insights',
  standalone: true,
  imports: [CommonModule, ...PANEL_KIT],
  template: `
    <section class="pk">
      <div class="pk-head">
        <div><h2>Tus productos este mes</h2><p>Ventas, producción, márgenes y stock</p></div>
        <app-pk-live *ngIf="!loading" [updatedAt]="lastUpdated" [stale]="stale" [refreshing]="refreshing" (refresh)="refresh()"></app-pk-live>
      </div>

      <div class="pk-grid" *ngIf="loading"><div class="pk-skeleton" *ngFor="let i of [1, 2, 3, 4]"></div></div>
      <div class="pk-error" *ngIf="error && !loading">{{ error }}</div>

      <ng-container *ngIf="data as d">
        <div class="pk-grid">
          <app-pk-kpi icon="graph-up-arrow" tone="violet" label="Vendido este mes" [value]="compactMoney(d.kpis.revenueMonth)" [title]="money(d.kpis.revenueMonth)">
            <span>{{ d.kpis.unitsSoldMonth }} unidad(es)</span>
          </app-pk-kpi>
          <app-pk-kpi icon="gear-wide-connected" tone="blue" label="Producido este mes" [value]="d.kpis.producedMonth">
            <span>{{ d.kpis.batchesMonth }} lote(s) de producción</span>
          </app-pk-kpi>
          <app-pk-kpi icon="percent" tone="green" label="Margen promedio" [value]="d.kpis.avgMargin === null ? '—' : d.kpis.avgMargin + '%'" [alert]="d.alerts.lowMargin.length > 0">
            <span class="pk-chip" [class.warn]="d.alerts.lowMargin.length" [class.ok]="!d.alerts.lowMargin.length">
              {{ d.alerts.lowMargin.length ? d.alerts.lowMargin.length + ' con margen bajo' : 'Márgenes sanos' }}
            </span>
          </app-pk-kpi>
          <app-pk-kpi icon="box-seam" tone="orange" label="Por reponer" [value]="d.kpis.lowStock" [alert]="d.kpis.outOfStock > 0">
            <span class="pk-chip" [class.danger]="d.kpis.outOfStock" [class.ok]="!d.kpis.outOfStock">{{ d.kpis.outOfStock ? d.kpis.outOfStock + ' agotado(s)' : 'Nada agotado' }}</span>
          </app-pk-kpi>
        </div>

        <div class="pk-grid">
          <app-pk-mini icon="box-seam" tone="blue" [title]="d.kpis.products + ' productos'" [sub]="'Valor en stock ' + compactMoney(d.kpis.value)"></app-pk-mini>
          <app-pk-mini icon="shop" tone="rose" [title]="d.kpis.inMarketplace + ' en el MarketPlace'" sub="Visibles para tus clientes"></app-pk-mini>
          <app-pk-mini icon="tools" tone="violet" [title]="d.kpis.madeToOrder + ' bajo pedido'" sub="Se fabrican al pedirlos"></app-pk-mini>
          <app-pk-mini icon="hourglass-bottom" tone="gray" [title]="d.kpis.noSales30 + ' sin ventas'" sub="En los últimos 30 días"></app-pk-mini>
        </div>

        <div class="pk-row">
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Requiere atención</h3><span class="pk-count" *ngIf="attention.length">{{ attention.length }}</span></header>
            <app-pk-attention [items]="attention" [rows]="rows" emptyText="Sin productos agotados, con margen bajo ni sin ventas."></app-pk-attention>
          </article>
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Lo más vendido</h3><small>Este mes</small></header>
            <app-pk-bars [items]="top" tone="green" emptyText="Aún no hay ventas este mes."></app-pk-bars>
          </article>
        </div>

        <article class="pk-panel">
          <header class="pk-panel-head"><h3>Producción reciente</h3><small>Últimos 30 días</small></header>
          <ul class="pk-feed" *ngIf="d.recentProductions.length; else noProd">
            <li *ngFor="let p of d.recentProductions; trackBy: byId">
              <span class="fi in"><svg viewBox="0 0 16 16"><use xlink:href="./assets/icons/bootstrap-icons.svg#gear-wide-connected"/></svg></span>
              <span class="fb"><strong>{{ p.name }}</strong><small>{{ p.quantity }} unidad(es){{ p.batch ? ' · lote ' + p.batch : '' }}</small></span>
              <time>{{ relativeTime(p.at) }}</time>
            </li>
          </ul>
          <ng-template #noProd><p class="pk-empty">Sin producción en los últimos 30 días.</p></ng-template>
        </article>
      </ng-container>
    </section>`,
})
export class ProductsInsightsComponent extends LivePanel<ProductsPanel> implements OnChanges {
  @Input() refreshKey = 0;
  attention: PkAttention[] = [];
  rows: PkRow[] = [];
  top: PkBar[] = [];
  private http = inject(HttpClient);

  protected fetch() {
    return this.http.get<ProductsPanel>(`${environment.apiUrl}/dashboard/products`);
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['refreshKey'] && !c['refreshKey'].firstChange) this.refresh();
  }

  protected override onData(d: ProductsPanel): void {
    const a: PkAttention[] = [];
    if (d.kpis.outOfStock) a.push({ icon: 'x-octagon-fill', tone: 'danger', count: d.kpis.outOfStock, label: 'Productos agotados', detail: 'No se pueden vender hasta producir', link: '/products' });
    if (d.kpis.lowStock) a.push({ icon: 'exclamation-triangle-fill', tone: 'warning', count: d.kpis.lowStock, label: 'Bajo el mínimo', detail: 'Programa su producción', link: '/products' });
    if (d.alerts.lowMargin.length) a.push({ icon: 'percent', tone: 'warning', count: d.alerts.lowMargin.length, label: 'Margen menor al 15 %', detail: 'Revisa su precio o su costo', link: '/products' });
    if (d.kpis.noSales30) a.push({ icon: 'hourglass-bottom', tone: 'info', count: d.kpis.noSales30, label: 'Sin ventas en 30 días', detail: 'Promociónalos o revisa si siguen en tu catálogo', link: '/products' });
    this.attention = a;
    this.rows = [
      ...d.alerts.outOfStock.map((p) => ({ tone: 'danger' as const, main: p.name, meta: 'agotado' })),
      ...d.alerts.lowStock.map((p) => ({ tone: 'warning' as const, main: p.name, meta: `${p.stock} de mín. ${p.min}` })),
      ...d.alerts.lowMargin.map((p) => ({ tone: 'warning' as const, main: p.name, meta: `margen ${p.margin}%` })),
      ...d.alerts.noSales.map((p) => ({ tone: 'info' as const, main: p.name, meta: 'sin ventas' })),
    ].slice(0, 8);
    this.top = this.withShare(d.topSold).map((t) => ({ ...t, label: this.compactMoney(t.value), sub: `${t.quantity} und` }));
  }

  byId = (_: number, a: { id: string }) => a.id;
}
