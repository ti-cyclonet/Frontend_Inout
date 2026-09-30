import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { LivePanel } from '../../../shared/components/panel-kit/live-panel';
import { PANEL_KIT, PkAttention, PkBar, PkRow } from '../../../shared/components/panel-kit/panel-kit.components';

interface CustomersPanel {
  kpis: { total: number; newThisMonth: number; active30: number; recurrent: number; recurrentPercent: number | null; avgPerCustomer: number; withOverdue: number; atRisk: number };
  topCustomers: { id: string; name: string; value: number; count: number }[];
  atRisk: { id: string; name: string; value: number; daysSince: number }[];
  overdue: { id: string; name: string; balance: number }[];
  newest: { id: string; name: string; at: string }[];
}

/** Indicadores del panel de Clientes (GET /dashboard/customers), en vivo. */
@Component({
  selector: 'app-customers-insights',
  standalone: true,
  imports: [CommonModule, ...PANEL_KIT],
  template: `
    <section class="pk">
      <div class="pk-head">
        <div><h2>Tus clientes</h2><p>Compras de los últimos 90 días, recurrencia y cartera</p></div>
        <app-pk-live *ngIf="!loading" [updatedAt]="lastUpdated" [stale]="stale" [refreshing]="refreshing" (refresh)="refresh()"></app-pk-live>
      </div>

      <div class="pk-grid" *ngIf="loading"><div class="pk-skeleton" *ngFor="let i of [1, 2, 3, 4]"></div></div>
      <div class="pk-error" *ngIf="error && !loading">{{ error }}</div>

      <ng-container *ngIf="data as d">
        <div class="pk-grid">
          <app-pk-kpi icon="people-fill" tone="blue" label="Clientes" [value]="d.kpis.total">
            <span>{{ d.kpis.newThisMonth }} nuevo(s) este mes</span>
          </app-pk-kpi>
          <app-pk-kpi icon="person-check-fill" tone="green" label="Compraron en 30 días" [value]="d.kpis.active30">
            <span>clientes activos</span>
          </app-pk-kpi>
          <app-pk-kpi icon="arrow-repeat" tone="violet" label="Recurrentes" [value]="d.kpis.recurrentPercent === null ? '—' : d.kpis.recurrentPercent + '%'">
            <span>{{ d.kpis.recurrent }} compraron 2 o más veces</span>
          </app-pk-kpi>
          <app-pk-kpi icon="wallet2" tone="rose" label="Compra promedio" [value]="compactMoney(d.kpis.avgPerCustomer)" [title]="money(d.kpis.avgPerCustomer)" [alert]="d.kpis.withOverdue > 0">
            <span class="pk-chip" [class.danger]="d.kpis.withOverdue" [class.ok]="!d.kpis.withOverdue">{{ d.kpis.withOverdue ? d.kpis.withOverdue + ' con cartera vencida' : 'Cartera al día' }}</span>
          </app-pk-kpi>
        </div>

        <div class="pk-row thirds">
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Requiere atención</h3><span class="pk-count" *ngIf="attention.length">{{ attention.length }}</span></header>
            <app-pk-attention [items]="attention" [rows]="rows" emptyText="Ningún cliente con cartera vencida ni en riesgo de no volver."></app-pk-attention>
          </article>
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Mejores clientes</h3><small>Últimos 90 días</small></header>
            <app-pk-bars [items]="top" tone="violet" emptyText="Aún no hay compras de clientes registrados."></app-pk-bars>
          </article>
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Nuevos clientes</h3></header>
            <ul class="pk-feed" style="grid-template-columns: 1fr" *ngIf="d.newest.length; else none">
              <li *ngFor="let c of d.newest; trackBy: byId">
                <span class="fi in"><svg viewBox="0 0 16 16"><use xlink:href="./assets/icons/bootstrap-icons.svg#person-plus-fill"/></svg></span>
                <span class="fb"><strong>{{ c.name }}</strong><small>Se registró</small></span>
                <time>{{ relativeTime(c.at) }}</time>
              </li>
            </ul>
            <ng-template #none><p class="pk-empty">Sin clientes nuevos.</p></ng-template>
          </article>
        </div>
      </ng-container>
    </section>`,
})
export class CustomersInsightsComponent extends LivePanel<CustomersPanel> implements OnChanges {
  @Input() refreshKey = 0;
  attention: PkAttention[] = [];
  rows: PkRow[] = [];
  top: PkBar[] = [];
  private http = inject(HttpClient);

  protected fetch() {
    return this.http.get<CustomersPanel>(`${environment.apiUrl}/dashboard/customers`);
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['refreshKey'] && !c['refreshKey'].firstChange) this.refresh();
  }

  protected override onData(d: CustomersPanel): void {
    const a: PkAttention[] = [];
    if (d.kpis.withOverdue) a.push({ icon: 'exclamation-octagon-fill', tone: 'danger', count: d.kpis.withOverdue, label: 'Con cartera vencida', detail: 'Clientes con cuentas por cobrar vencidas', link: '/sales', query: { tab: 'cartera' } });
    if (d.kpis.atRisk) a.push({ icon: 'person-dash-fill', tone: 'warning', count: d.kpis.atRisk, label: 'En riesgo de no volver', detail: 'Compraban seguido y llevan más de 30 días sin comprar' });
    this.attention = a;
    this.rows = [
      ...d.overdue.map((c) => ({ tone: 'danger' as const, main: c.name, meta: `${this.money(c.balance)} vencido` })),
      ...d.atRisk.map((c) => ({ tone: 'warning' as const, main: c.name, meta: `${c.daysSince} d sin comprar` })),
    ].slice(0, 8);
    this.top = this.withShare(d.topCustomers).map((c) => ({ ...c, label: this.compactMoney(c.value), sub: `${c.count} compra(s)` }));
  }

  byId = (_: number, a: { id: string }) => a.id;
}
