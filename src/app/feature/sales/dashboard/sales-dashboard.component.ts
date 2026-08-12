import { Component, EventEmitter, Input, OnInit, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SalesService } from '../../../shared/services/sales.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sales-dashboard.component.html',
  styleUrl: './sales-dashboard.component.css'
})
export class SalesDashboardComponent implements OnInit, OnChanges {
  @Input() refreshTrigger = 0;
  @Output() openCreateModal = new EventEmitter<void>();
  @Output() openOrderModal = new EventEmitter<void>();
  @Output() openCustomerTab = new EventEmitter<void>();

  // Ventas
  totalSales = 0;
  totalRevenue = 0;
  pendingSales = 0;
  recentSales: any[] = [];

  // Pedidos
  orderStats = { total: 0, inProduction: 0, delivered: 0 };
  orderStatusBars: { label: string; count: number; percentage: number; color: string }[] = [];

  // Clientes
  customerStats = { total: 0, active: 0, recent: 0 };

  // Fidelidad
  loyaltyRanking: { name: string; purchases: number; totalSpent: number; score: number; scorePercent: number }[] = [];

  private baseUrl = environment.apiUrl;

  constructor(private salesService: SalesService, private http: HttpClient) {}

  ngOnInit(): void {
    this.loadAll();
  }

  ngOnChanges(): void {
    if (this.refreshTrigger > 0) {
      this.loadAll();
    }
  }

  loadAll(): void {
    this.loadSalesStats();
    this.loadRecentSales();
    this.loadOrderStats();
    this.loadCustomerStats();
    this.loadLoyaltyRanking();
  }

  loadSalesStats(): void {
    this.salesService.getStats().subscribe({
      next: (stats) => {
        this.totalSales = stats.totalSales || 0;
        this.totalRevenue = stats.totalRevenue || 0;
        this.pendingSales = stats.pendingSales || 0;
      },
      error: () => {}
    });
  }

  loadRecentSales(): void {
    this.salesService.getSales().subscribe({
      next: (response: any) => {
        const sales = response.data || response || [];
        this.recentSales = sales.slice(0, 5);
      },
      error: () => { this.recentSales = []; }
    });
  }

  loadOrderStats(): void {
    this.http.get<any>(`${this.baseUrl}/orders/stats`).subscribe({
      next: (stats) => {
        this.orderStats.total = stats.total || 0;
        this.orderStats.inProduction = stats.IN_PRODUCTION || 0;
        this.orderStats.delivered = (stats.DELIVERED || 0) + (stats.INVOICED || 0);

        // Build status bars
        const statuses = [
          { key: 'DRAFT', label: 'Borrador', color: '#6b7280' },
          { key: 'CONFIRMED', label: 'Confirmado', color: '#2563eb' },
          { key: 'IN_PRODUCTION', label: 'En Producción', color: '#d97706' },
          { key: 'READY', label: 'Listo', color: '#16a34a' },
          { key: 'DELIVERED', label: 'Entregado', color: '#0d9488' },
        ];
        const maxCount = Math.max(...statuses.map(s => stats[s.key] || 0), 1);
        this.orderStatusBars = statuses.map(s => ({
          label: s.label,
          count: stats[s.key] || 0,
          percentage: ((stats[s.key] || 0) / maxCount) * 100,
          color: s.color,
        }));
      },
      error: () => {}
    });
  }

  loadCustomerStats(): void {
    this.http.get<any>(`${this.baseUrl}/customers`).subscribe({
      next: (response: any) => {
        const customers = response.data || response || [];
        this.customerStats.total = customers.length;
        this.customerStats.active = customers.filter((c: any) => c.status === 'ACTIVE' || c.isActive).length;
        // Recent = created in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        this.customerStats.recent = customers.filter((c: any) => 
          new Date(c.createdAt) >= thirtyDaysAgo
        ).length;
      },
      error: () => {}
    });
  }

  formatCurrency(value: number): string {
    return '$' + new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  loadLoyaltyRanking(): void {
    // Build loyalty from sales data - count purchases per customer
    this.salesService.getSales().subscribe({
      next: (response: any) => {
        const sales = response.data || response || [];
        const customerMap: Record<string, { name: string; purchases: number; totalSpent: number }> = {};

        for (const sale of sales) {
          const name = sale.customerName || 'Consumidor Final';
          if (name === 'Consumidor Final' || !name.trim()) continue;

          if (!customerMap[name]) {
            customerMap[name] = { name, purchases: 0, totalSpent: 0 };
          }
          customerMap[name].purchases++;
          customerMap[name].totalSpent += parseFloat(sale.total?.toString() || '0') ||
            (parseFloat(sale.fltQuantity?.toString() || '0') * parseFloat(sale.fltUnitPrice?.toString() || '0'));
        }

        // Score: purchases * 10 + totalSpent / 10000
        const ranked = Object.values(customerMap)
          .map(c => ({
            ...c,
            score: Math.round(c.purchases * 10 + c.totalSpent / 10000),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        const maxScore = ranked.length > 0 ? ranked[0].score : 1;
        this.loyaltyRanking = ranked.map(c => ({
          ...c,
          scorePercent: Math.round((c.score / maxScore) * 100),
        }));
      },
      error: () => { this.loyaltyRanking = []; }
    });
  }
}
