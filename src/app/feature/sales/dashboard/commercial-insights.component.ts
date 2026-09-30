import { AfterViewChecked, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { environment } from '../../../../environments/environment';
import { LivePanel } from '../../../shared/components/panel-kit/live-panel';
import { PANEL_KIT, PkAttention, PkBar } from '../../../shared/components/panel-kit/panel-kit.components';

Chart.register(...registerables);

interface Group { label: string; value: number; count: number }
interface CommercialPanel {
  kpis: {
    revenueMonth: number; revenuePrevMonth: number; countMonth: number; countPrevMonth: number; avgTicket: number;
    today: number; todayCount: number; creditShare: number; activeOrders: number; delayedOrders: number; cancelledMonth: number;
  };
  byChannel: Group[];
  byPaymentType: Group[];
  byMethod: Group[];
  topCustomers: { name: string; value: number; count: number }[];
  ordersByStage: Record<string, number>;
  days: { date: string; revenue: number }[];
}

const STAGES = [
  { key: 'CONFIRMED', label: 'Confirmados', color: '#4facfe' },
  { key: 'IN_PRODUCTION', label: 'En producción', color: '#f5a623' },
  { key: 'READY', label: 'Listos', color: '#38ef7d' },
  { key: 'OUT_FOR_DELIVERY', label: 'En reparto', color: '#667eea' },
];
const MIX_COLORS = ['#0057b8', '#11998e', '#f5a623', '#667eea', '#f5576c', '#94a3b8'];

/** Indicadores del panel Comercial (GET /dashboard/commercial), en vivo. */
@Component({
  selector: 'app-commercial-insights',
  standalone: true,
  imports: [CommonModule, ...PANEL_KIT],
  template: `
    <section class="pk">
      <div class="pk-head">
        <div><h2>Así van tus ventas</h2><p>Ventas directas y pedidos entregados, este mes</p></div>
        <app-pk-live *ngIf="!loading" [updatedAt]="lastUpdated" [stale]="stale" [refreshing]="refreshing" (refresh)="refresh()"></app-pk-live>
      </div>

      <div class="pk-grid" *ngIf="loading"><div class="pk-skeleton" *ngFor="let i of [1, 2, 3, 4]"></div></div>
      <div class="pk-error" *ngIf="error && !loading">{{ error }}</div>

      <ng-container *ngIf="data as d">
        <div class="pk-grid">
          <app-pk-kpi icon="graph-up-arrow" tone="violet" label="Ventas del mes" [value]="compactMoney(d.kpis.revenueMonth)" [title]="money(d.kpis.revenueMonth)">
            <app-pk-delta [value]="delta(d.kpis.revenueMonth, d.kpis.revenuePrevMonth)"></app-pk-delta><span>vs. mes anterior</span>
          </app-pk-kpi>
          <app-pk-kpi icon="cash-coin" tone="green" label="Vendido hoy" [value]="compactMoney(d.kpis.today)" [title]="money(d.kpis.today)">
            <span>{{ d.kpis.todayCount }} venta(s)</span>
          </app-pk-kpi>
          <app-pk-kpi icon="receipt" tone="blue" label="Ticket promedio" [value]="compactMoney(d.kpis.avgTicket)" [title]="money(d.kpis.avgTicket)">
            <app-pk-delta [value]="delta(d.kpis.countMonth, d.kpis.countPrevMonth)"></app-pk-delta><span>{{ d.kpis.countMonth }} venta(s) en el mes</span>
          </app-pk-kpi>
          <app-pk-kpi icon="kanban" tone="orange" label="Pedidos en curso" [value]="d.kpis.activeOrders" [alert]="d.kpis.delayedOrders > 0">
            <span class="pk-chip" [class.danger]="d.kpis.delayedOrders" [class.ok]="!d.kpis.delayedOrders">{{ d.kpis.delayedOrders ? d.kpis.delayedOrders + ' atrasado(s)' : 'Al día' }}</span>
          </app-pk-kpi>
        </div>

        <div class="pk-row">
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Requiere atención</h3><span class="pk-count" *ngIf="attention.length">{{ attention.length }}</span></header>
            <app-pk-attention [items]="attention" emptyText="Sin pedidos atrasados ni cancelaciones este mes."></app-pk-attention>
            <header class="pk-panel-head" style="margin-top: 1rem"><h3>Pedidos por etapa</h3><small>{{ d.kpis.activeOrders }} en curso</small></header>
            <div class="pk-split" *ngIf="d.kpis.activeOrders; else noOrders">
              <span *ngFor="let s of stages" [style.flex-grow]="d.ordersByStage[s.key] || 0" [style.background]="s.color" [title]="s.label"></span>
            </div>
            <ng-template #noOrders><p class="pk-empty" style="margin: 0.4rem 0">No hay pedidos en curso.</p></ng-template>
            <ul class="pk-legend" style="display: grid; grid-template-columns: 1fr 1fr">
              <li *ngFor="let s of stages"><span class="sw" [style.background]="s.color"></span><span class="ln">{{ s.label }}</span><strong>{{ d.ordersByStage[s.key] || 0 }}</strong></li>
            </ul>
          </article>
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Ventas diarias</h3><small>Últimos 14 días</small></header>
            <div style="position: relative; height: 260px"><canvas #trend></canvas></div>
          </article>
        </div>

        <div class="pk-row thirds">
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Cómo te pagan</h3><small>Este mes</small></header>
            <ng-container *ngTemplateOutlet="mix; context: { $implicit: d.byMethod }"></ng-container>
          </article>
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Contado y crédito</h3><small>{{ d.kpis.creditShare }}% a crédito</small></header>
            <ng-container *ngTemplateOutlet="mix; context: { $implicit: d.byPaymentType }"></ng-container>
            <header class="pk-panel-head" style="margin-top: 1rem"><h3>Por canal</h3></header>
            <ng-container *ngTemplateOutlet="mix; context: { $implicit: d.byChannel }"></ng-container>
          </article>
          <article class="pk-panel">
            <header class="pk-panel-head"><h3>Mejores clientes</h3><small>Este mes</small></header>
            <app-pk-bars [items]="customers" tone="violet" emptyText="Aún no hay ventas a clientes registrados este mes."></app-pk-bars>
          </article>
        </div>
      </ng-container>
    </section>

    <ng-template #mix let-groups>
      <ng-container *ngIf="groups.length; else noMix">
        <div class="pk-split"><span *ngFor="let g of groups; let i = index" [style.flex-grow]="g.value" [style.background]="color(i)" [title]="g.label"></span></div>
        <ul class="pk-legend">
          <li *ngFor="let g of groups; let i = index"><span class="sw" [style.background]="color(i)"></span><span class="ln">{{ g.label }} · {{ g.count }}</span><strong>{{ compactMoney(g.value) }}</strong></li>
        </ul>
      </ng-container>
      <ng-template #noMix><p class="pk-empty">Sin ventas este mes.</p></ng-template>
    </ng-template>`,
})
export class CommercialInsightsComponent extends LivePanel<CommercialPanel> implements OnChanges, AfterViewChecked, OnDestroy {
  @Input() refreshKey = 0;
  @ViewChild('trend') trendCanvas?: ElementRef<HTMLCanvasElement>;
  readonly stages = STAGES;
  attention: PkAttention[] = [];
  customers: PkBar[] = [];
  private http = inject(HttpClient);
  private chart?: Chart;
  private chartDirty = false;

  protected override refreshMs = 30_000;

  protected fetch() {
    return this.http.get<CommercialPanel>(`${environment.apiUrl}/dashboard/commercial`);
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['refreshKey'] && !c['refreshKey'].firstChange) this.refresh();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.chart?.destroy();
  }

  protected override onData(d: CommercialPanel): void {
    const a: PkAttention[] = [];
    if (d.kpis.delayedOrders) a.push({ icon: 'alarm-fill', tone: 'danger', count: d.kpis.delayedOrders, label: 'Pedidos atrasados', detail: 'Superaron el tiempo de su etapa', link: '/orders' });
    if (d.kpis.cancelledMonth) a.push({ icon: 'x-circle', tone: 'info', count: d.kpis.cancelledMonth, label: 'Pedidos cancelados este mes', detail: 'Revisa los motivos para evitarlos', link: '/orders' });
    this.attention = a;
    this.customers = this.withShare(d.topCustomers).map((c) => ({ ...c, label: this.compactMoney(c.value), sub: `${c.count} compra(s)` }));
    this.chartDirty = true;
  }

  ngAfterViewChecked(): void {
    if (!this.chartDirty || !this.trendCanvas || !this.data) return;
    this.chartDirty = false;
    const days = this.data.days;
    const labels = days.map((x) => new Date(x.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }));
    const values = days.map((x) => x.revenue);
    if (this.chart && this.chart.canvas === this.trendCanvas.nativeElement) {
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = values;
      this.chart.update('none');
      return;
    }
    this.chart?.destroy();
    const ctx = this.trendCanvas.nativeElement.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 240);
    g.addColorStop(0, 'rgba(102, 126, 234, 0.35)');
    g.addColorStop(1, 'rgba(102, 126, 234, 0)');
    const font = { family: 'Ubuntu, system-ui, sans-serif', size: 11 };
    this.chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Ventas', data: values, borderColor: '#667eea', backgroundColor: g, fill: true, tension: 0.35, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Ventas: ${this.money(c.parsed.y || 0)}` } } },
        scales: {
          x: { grid: { display: false }, ticks: { font, maxTicksLimit: 7 } },
          y: { beginAtZero: true, grid: { color: 'rgba(15,23,42,.06)' }, ticks: { font, callback: (v) => this.compactMoney(Number(v)) } },
        },
      },
    });
  }

  color(i: number): string { return MIX_COLORS[i % MIX_COLORS.length]; }
}
