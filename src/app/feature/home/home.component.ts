import { Component, ElementRef, HostListener, Inject, NgZone, OnDestroy, OnInit, PLATFORM_ID, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { Subscription, switchMap } from 'rxjs';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';
import { decodeJwtPayload } from '../../shared/utils/jwt.util';
import { AuthService } from '../../shared/services/auth/auth.service';
import { formatCop } from '../../shared/utils/currency.util';

Chart.register(...registerables);

/** Cada cuánto se refrescan los indicadores (solo con la pestaña visible). */
const REFRESH_MS = 30_000;
/** Cada cuánto se revisa el token, aunque la pestaña esté oculta. */
const KEEPALIVE_MS = 60_000;

/** Respuesta de GET /dashboard/overview (Backend_Inout/src/dashboard). */
export interface InoutOverview {
  generatedAt: string;
  sales: { monthRevenue: number; prevMonthRevenue: number; monthCount: number; prevMonthCount: number; avgTicket: number; todayRevenue: number; todayCount: number };
  orders: { active: number; byStage: Record<string, number>; delayed: number; scheduledToday: number; pendingPayments: number; activeValue: number };
  receivables: { balance: number; count: number; overdueBalance: number; overdueCount: number };
  inventory: { value: number; materialsValue: number; productsValue: number; productsCount: number; materialsCount: number; lowStockCount: number; healthPercent: number | null };
  customers: { total: number; newThisMonth: number };
  alerts: {
    lowStock: { name: string; stock: number; min: number; kind: string; unit?: string }[];
    delayedOrders: { id: string; code: string; customer: string; status: string; minutesLate: number }[];
    overdueReceivables: { id: string; code: string; customer: string; balance: number; dueDate: string }[];
    expiringLots: { id: string; name: string; expiresAt: string; quantity: number; daysLeft: number }[];
  };
  series: {
    months: { key: string; label: string; revenue: number; count: number }[];
    days: { date: string; revenue: number; count: number }[];
    topProducts: { name: string; value: number; quantity: number }[];
  };
  activity: { id: string; kind: string; title: string; detail: string; value: number; at: string }[];
}

interface AttentionItem { icon: string; tone: 'danger' | 'warning' | 'info'; count: number; label: string; detail: string; link: string; query?: Record<string, string> }

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'CONFIRMED', label: 'Confirmados', color: '#4facfe' },
  { key: 'IN_PRODUCTION', label: 'En producción', color: '#f5a623' },
  { key: 'READY', label: 'Listos', color: '#38ef7d' },
  { key: 'OUT_FOR_DELIVERY', label: 'En reparto', color: '#667eea' },
];

/**
 * Dashboard de InOut: la operación del negocio en sesión, en tiempo real (se
 * refresca cada 30 s y al volver a la pestaña). Puede quedar abierto: no
 * cierra sesión por inactividad (IdleTimeoutService) y renueva el token.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('trendCanvas') trendCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('monthsCanvas') monthsCanvas?: ElementRef<HTMLCanvasElement>;

  /** Pedidos nuevos: recibidos (CONFIRMED) que aún nadie empezó a preparar. */
  get newOrders(): number {
    return this.overview?.orders?.byStage?.['CONFIRMED'] || 0;
  }

  overview: InoutOverview | null = null;
  loading = true;
  refreshing = false;
  error: string | null = null;
  stale = false;
  sessionEnded = false;
  lastUpdated: Date | null = null;
  now = Date.now();
  freshActivity = new Set<string>();

  attention: AttentionItem[] = [];
  pipeline: { key: string; label: string; color: string; count: number; share: number }[] = [];
  topProducts: { name: string; value: number; quantity: number; share: number }[] = [];

  readonly stages = STAGES;
  readonly businessName = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user_displayName') || '' : '';
  readonly userName = (() => {
    if (typeof sessionStorage === 'undefined') return '';
    const n = sessionStorage.getItem('user_name') || '';
    return n.includes('@') ? '' : n.split(' ')[0];
  })();

  private readonly baseUrl = environment.apiUrl;
  private trendChart?: Chart;
  private monthsChart?: Chart;
  private refreshTimer: any;
  private keepAliveTimer: any;
  private clockTimer: any;
  private sub?: Subscription;
  private seen = new Set<string>();
  private readonly isBrowser: boolean;

  constructor(
    private http: HttpClient,
    private router: Router,
    private authService: AuthService,
    private zone: NgZone,
    @Inject(PLATFORM_ID) platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.refresh(true);
    this.refreshTimer = setInterval(() => { if (!document.hidden) this.refresh(); }, REFRESH_MS);
    this.keepAliveTimer = setInterval(() => this.keepAlive(), KEEPALIVE_MS);
    this.zone.runOutsideAngular(() => {
      this.clockTimer = setInterval(() => this.zone.run(() => (this.now = Date.now())), 5_000);
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshTimer);
    clearInterval(this.keepAliveTimer);
    clearInterval(this.clockTimer);
    this.sub?.unsubscribe();
    this.trendChart?.destroy();
    this.monthsChart?.destroy();
  }

  @HostListener('document:visibilitychange')
  onVisibility(): void {
    if (this.isBrowser && !document.hidden && this.lastUpdated && Date.now() - this.lastUpdated.getTime() > 10_000) this.refresh();
  }

  refresh(first = false): void {
    if (this.refreshing || this.sessionEnded) return;
    this.refreshing = true;
    this.sub?.unsubscribe();
    this.sub = this.authService.renewSessionIfNeeded().pipe(
      switchMap(() => this.http.get<InoutOverview>(`${this.baseUrl}/dashboard/overview`)),
    ).subscribe({
      next: (o) => {
        this.markFresh(o, first);
        this.overview = o;
        this.attention = this.buildAttention(o);
        this.pipeline = this.buildPipeline(o);
        this.topProducts = this.buildTop(o);
        this.lastUpdated = new Date();
        this.now = Date.now();
        this.loading = false;
        this.refreshing = false;
        this.error = null;
        this.stale = false;
        // Los canvas existen después de pintar la vista con los datos
        setTimeout(() => this.renderCharts(o));
      },
      error: () => {
        this.refreshing = false;
        this.loading = false;
        if (this.authService.sessionExpired()) { this.endSession(); return; }
        if (this.overview) this.stale = true;
        else this.error = 'No se pudieron cargar los indicadores. Se reintentará automáticamente.';
      },
    });
  }

  private keepAlive(): void {
    if (this.sessionEnded) return;
    this.authService.renewSessionIfNeeded().subscribe(() => {
      if (this.authService.sessionExpired()) this.endSession();
    });
  }

  private endSession(): void {
    this.sessionEnded = true;
    clearInterval(this.refreshTimer);
    clearInterval(this.keepAliveTimer);
  }

  goToLogin(): void {
    sessionStorage.clear();
    window.location.href = '/login';
  }

  // ─── Indicadores ────────────────────────────────────────────────────────

  delta(current: number, previous: number): number | null {
    if (!previous) return current ? null : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  get greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  get monthLabel(): string {
    return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(new Date());
  }

  get updatedLabel(): string {
    if (!this.lastUpdated) return '';
    const s = Math.max(0, Math.round((this.now - this.lastUpdated.getTime()) / 1000));
    if (s < 10) return 'justo ahora';
    if (s < 60) return `hace ${s} s`;
    return `hace ${Math.floor(s / 60)} min`;
  }

  private buildAttention(o: InoutOverview): AttentionItem[] {
    const items: AttentionItem[] = [];
    if (this.newOrders) items.push({ icon: 'bell-fill', tone: 'info', count: this.newOrders, label: this.newOrders === 1 ? 'Pedido nuevo' : 'Pedidos nuevos', detail: 'Recibidos y aún sin empezar a preparar', link: '/orders' });
    if (o.orders.pendingPayments) items.push({ icon: 'cash-stack', tone: 'warning', count: o.orders.pendingPayments, label: 'Pagos por verificar', detail: 'Comprobantes enviados por tus clientes', link: '/orders' });
    if (o.orders.delayed) items.push({ icon: 'alarm-fill', tone: 'danger', count: o.orders.delayed, label: 'Pedidos atrasados', detail: 'Superaron el tiempo de su etapa', link: '/orders' });
    if (o.orders.scheduledToday) items.push({ icon: 'calendar-check', tone: 'info', count: o.orders.scheduledToday, label: 'Entregas programadas hoy', detail: 'Pedidos con fecha de entrega para hoy', link: '/orders' });
    if (o.receivables.overdueCount) items.push({ icon: 'exclamation-octagon-fill', tone: 'danger', count: o.receivables.overdueCount, label: 'Cartera vencida', detail: `${this.money(o.receivables.overdueBalance)} por cobrar`, link: '/sales', query: { tab: 'cartera' } });
    if (o.inventory.lowStockCount) items.push({ icon: 'box-seam', tone: 'warning', count: o.inventory.lowStockCount, label: 'Stock bajo el mínimo', detail: 'Productos y materiales por reponer', link: '/inventory' });
    if (o.alerts.expiringLots.length) items.push({ icon: 'hourglass-split', tone: 'warning', count: o.alerts.expiringLots.length, label: 'Lotes por vencer (15 días)', detail: `El más próximo en ${o.alerts.expiringLots[0].daysLeft} día(s)`, link: '/kardex' });
    return items;
  }

  private buildPipeline(o: InoutOverview) {
    const total = Math.max(1, o.orders.active);
    return STAGES.map((s) => ({ ...s, count: o.orders.byStage[s.key] || 0, share: Math.round(((o.orders.byStage[s.key] || 0) / total) * 100) }));
  }

  private buildTop(o: InoutOverview) {
    const max = Math.max(1, ...o.series.topProducts.map((p) => p.value));
    return o.series.topProducts.map((p) => ({ ...p, share: Math.round((p.value / max) * 100) }));
  }

  private markFresh(o: InoutOverview, first: boolean): void {
    this.freshActivity = new Set(first ? [] : o.activity.filter((a) => !this.seen.has(a.id)).map((a) => a.id));
    o.activity.forEach((a) => this.seen.add(a.id));
  }

  trackByLabel = (_: number, a: AttentionItem) => a.label;
  trackByKey = (_: number, a: { key: string }) => a.key;
  trackByName = (_: number, a: { name: string }) => a.name;
  trackById = (_: number, a: { id: string }) => a.id;

  // ─── Formato ────────────────────────────────────────────────────────────

  money(v: number): string { return formatCop(v); }

  compactMoney(value: number): string {
    const v = Math.round(value || 0);
    if (Math.abs(v) >= 1_000_000) return '$' + (v / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M';
    if (Math.abs(v) >= 10_000) return '$' + Math.round(v / 1000).toLocaleString('es-CO') + ' mil';
    return formatCop(v);
  }

  relativeTime(iso: string): string {
    const s = Math.max(0, Math.round((this.now - new Date(iso).getTime()) / 1000));
    if (s < 60) return 'hace un momento';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  }

  minutesLabel(min: number): string {
    return min < 60 ? `${min} min` : min < 1440 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${Math.floor(min / 1440)} d`;
  }

  private readonly activityMeta: Record<string, { icon: string; label: string }> = {
    SALE: { icon: 'receipt', label: 'Venta' },
    ORDER_SOLD: { icon: 'bag-check-fill', label: 'Pedido vendido' },
    CONFIRMED: { icon: 'clipboard-check', label: 'Confirmado' },
    IN_PRODUCTION: { icon: 'gear-wide-connected', label: 'En producción' },
    READY: { icon: 'check2-circle', label: 'Listo' },
    OUT_FOR_DELIVERY: { icon: 'truck', label: 'En reparto' },
  };
  activityIcon(kind: string): string { return this.activityMeta[kind]?.icon || 'dot'; }
  activityLabel(kind: string): string { return this.activityMeta[kind]?.label || kind; }

  // ─── Gráficas (Chart.js) ────────────────────────────────────────────────

  private renderCharts(o: InoutOverview): void {
    const font = { family: 'Ubuntu, system-ui, sans-serif', size: 11 };
    const grid = { color: 'rgba(15, 23, 42, 0.06)' };
    const money = (v: any) => this.compactMoney(Number(v));

    const days = o.series.days;
    const dayLabels = days.map((d) => new Date(d.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }));
    if (this.trendCanvas) {
      if (this.trendChart && this.trendChart.canvas === this.trendCanvas.nativeElement) {
        this.trendChart.data.labels = dayLabels;
        this.trendChart.data.datasets[0].data = days.map((d) => d.revenue);
        this.trendChart.update('none');
      } else {
        this.trendChart?.destroy();
        const ctx = this.trendCanvas.nativeElement.getContext('2d')!;
        const gradient = ctx.createLinearGradient(0, 0, 0, 260);
        gradient.addColorStop(0, 'rgba(102, 126, 234, 0.35)');
        gradient.addColorStop(1, 'rgba(102, 126, 234, 0)');
        this.trendChart = new Chart(ctx, {
          type: 'line',
          data: { labels: dayLabels, datasets: [{ label: 'Ventas', data: days.map((d) => d.revenue), borderColor: '#667eea', backgroundColor: gradient, fill: true, tension: 0.35, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5 }] },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Ventas: ${this.money(c.parsed.y || 0)}` } } },
            scales: { x: { grid: { display: false }, ticks: { font, maxTicksLimit: 7 } }, y: { beginAtZero: true, grid, ticks: { font, callback: money } } },
          },
        });
      }
    }

    const months = o.series.months;
    if (this.monthsCanvas) {
      if (this.monthsChart && this.monthsChart.canvas === this.monthsCanvas.nativeElement) {
        this.monthsChart.data.labels = months.map((m) => m.label);
        this.monthsChart.data.datasets[0].data = months.map((m) => m.revenue);
        this.monthsChart.update('none');
      } else {
        this.monthsChart?.destroy();
        this.monthsChart = new Chart(this.monthsCanvas.nativeElement, {
          type: 'bar',
          data: {
            labels: months.map((m) => m.label),
            datasets: [{ label: 'Ventas', data: months.map((m) => m.revenue), borderRadius: 8, barPercentage: 0.6,
              backgroundColor: months.map((_, i) => (i === months.length - 1 ? '#11998e' : 'rgba(17, 153, 142, 0.3)')) }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Ventas: ${this.money(c.parsed.y || 0)}` } } },
            scales: { x: { grid: { display: false }, ticks: { font } }, y: { beginAtZero: true, grid, ticks: { font, callback: money } } },
          },
        });
      }
    }
  }

  // ─── Accesos ────────────────────────────────────────────────────────────

  openSettings(): void {
    this.router.navigate(['/setting']);
  }

  openMarketplace(): void {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const payload = token ? decodeJwtPayload(token) : null;
    if (!payload) {
      Swal.fire({ icon: 'error', title: 'Sesión expirada', text: 'Por favor, inicia sesión nuevamente.' });
      return;
    }
    const tenantId = payload.tenantId || payload.basicDataId;
    this.http.get<any>(`${environment.auth.authorizaUrl}/contracts/tenant/${tenantId}`).subscribe({
      next: (contract) => window.open(`/marketplace/${contract.user.id}?admin=true`, '_blank'),
      error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se encontró un contrato para este usuario' }),
    });
  }
}
