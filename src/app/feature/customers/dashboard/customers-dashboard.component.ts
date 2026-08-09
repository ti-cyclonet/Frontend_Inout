import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { CustomersService } from '../../../shared/services/customers.service';
import { Customer } from '../../../shared/model/customer.model';
import { environment } from '../../../../environments/environment';

Chart.register(...registerables);

interface Sale {
  strId: string;
  strInvoiceCode: string;
  customerName: string;
  strProductId: string;
  fltQuantity: number;
  fltUnitPrice: number;
  total: number;
  dtmCreationDate: string;
  product?: { strName: string };
}

@Component({
  selector: 'app-customers-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-wrapper">
      <div class="dashboard-content">
        <!-- Metric Cards -->
        <div class="metrics-grid" *ngIf="!loading">
          <div class="metric-card">
            <div class="metric-icon blue">
              <svg viewBox="0 0 16 16" fill="currentColor"><use href="./assets/icons/bootstrap-icons.svg#people-fill"/></svg>
            </div>
            <div class="metric-info">
              <span class="metric-value">{{ totalCustomers }}</span>
              <span class="metric-label">Total Clientes</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon green">
              <svg viewBox="0 0 16 16" fill="currentColor"><use href="./assets/icons/bootstrap-icons.svg#person-check-fill"/></svg>
            </div>
            <div class="metric-info">
              <span class="metric-value">{{ activeCustomers }}</span>
              <span class="metric-label">Clientes Activos</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon purple">
              <svg viewBox="0 0 16 16" fill="currentColor"><use href="./assets/icons/bootstrap-icons.svg#building"/></svg>
            </div>
            <div class="metric-info">
              <span class="metric-value">{{ legalEntities }}</span>
              <span class="metric-label">Empresas</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon orange">
              <svg viewBox="0 0 16 16" fill="currentColor"><use href="./assets/icons/bootstrap-icons.svg#cart-fill"/></svg>
            </div>
            <div class="metric-info">
              <span class="metric-value">{{ totalSalesRevenue | number:'1.0-0' }}</span>
              <span class="metric-label">Ventas Totales</span>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div class="dashboard-loading" *ngIf="loading">
          <div class="spinner"></div>
          <span>Cargando datos...</span>
        </div>

        <!-- Charts Row -->
        <div class="charts-row" *ngIf="!loading">
          <div class="chart-card">
            <h4 class="chart-title">Ventas por Cliente</h4>
            <canvas #salesByClientChart></canvas>
          </div>
          <div class="chart-card">
            <h4 class="chart-title">Cliente más recurrente</h4>
            <canvas #recurrentClientChart></canvas>
          </div>
        </div>

        <!-- Products Table -->
        <div class="table-card" *ngIf="!loading && topProductsByClient.length > 0">
          <h4 class="chart-title">Productos más vendidos por cliente</h4>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Producto</th>
                  <th>Cantidad Total</th>
                  <th>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of topProductsByClient">
                  <td>{{ row.customerName }}</td>
                  <td>{{ row.productName }}</td>
                  <td>{{ row.totalQuantity | number:'1.0-2' }}</td>
                  <td>{{ row.totalRevenue | number:'1.0-0' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-wrapper {
      width: 100%;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.85rem;
      margin-bottom: 1.25rem;
    }

    .metric-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: white;
      border-radius: 12px;
      padding: 1rem 1.1rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      border-left: 3px solid transparent;
      transition: transform 0.15s, box-shadow 0.15s;
    }

    .metric-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .metric-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .metric-icon svg { width: 20px; height: 20px; }
    .metric-icon.blue { background: #dbeafe; color: #2563eb; }
    .metric-icon.green { background: #dcfce7; color: #16a34a; }
    .metric-icon.purple { background: #ede9fe; color: #7c3aed; }
    .metric-icon.orange { background: #ffedd5; color: #ea580c; }

    .metric-info {
      display: flex;
      flex-direction: column;
    }

    .metric-value {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1f2937;
      line-height: 1.2;
    }

    .metric-label {
      font-size: 0.7rem;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-top: 2px;
    }

    .dashboard-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 2rem;
      color: #6b7280;
      font-size: 0.85rem;
    }

    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid #e5e7eb;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .charts-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    @media (max-width: 768px) {
      .charts-row { grid-template-columns: 1fr; }
    }

    .chart-card {
      background: white;
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      overflow: hidden;
    }

    .chart-card canvas {
      max-height: 220px;
      width: 100% !important;
    }

    .chart-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #374151;
      margin: 0 0 0.75rem 0;
    }

    .table-card {
      background: white;
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      margin-bottom: 1rem;
    }

    .table-responsive {
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }

    .data-table th {
      text-align: left;
      padding: 0.6rem 0.75rem;
      background: #f9fafb;
      color: #6b7280;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.03em;
      border-bottom: 1px solid #e5e7eb;
    }

    .data-table td {
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid #f3f4f6;
      color: #374151;
    }

    .data-table tbody tr:hover {
      background: #f9fafb;
    }
  `]
})
export class CustomersDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('salesByClientChart') salesByClientChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('recurrentClientChart') recurrentClientChartRef!: ElementRef<HTMLCanvasElement>;

  loading = true;

  // Metrics
  totalCustomers = 0;
  activeCustomers = 0;
  legalEntities = 0;
  totalSalesRevenue = 0;

  // Chart data
  salesByClient: { name: string; total: number }[] = [];
  recurrentClients: { name: string; count: number }[] = [];

  // Table data
  topProductsByClient: { customerName: string; productName: string; totalQuantity: number; totalRevenue: number }[] = [];

  private customers: Customer[] = [];
  private sales: Sale[] = [];
  private chartsReady = false;
  private dataReady = false;

  private salesChart: Chart | null = null;
  private recurrentChart: Chart | null = null;

  constructor(
    private customersService: CustomersService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.chartsReady = true;
    if (this.dataReady) {
      this.renderCharts();
    }
  }

  private loadData(): void {
    let customersLoaded = false;
    let salesLoaded = false;

    this.customersService.getCustomers().subscribe({
      next: (customers: Customer[]) => {
        this.customers = customers;
        this.totalCustomers = customers.length;
        this.activeCustomers = customers.filter(c => c.status === 'ACTIVE').length;
        this.legalEntities = customers.filter(c => c.personType === 'J').length;
        customersLoaded = true;
        if (salesLoaded) this.processData();
      },
      error: () => {
        customersLoaded = true;
        if (salesLoaded) this.processData();
      }
    });

    this.http.get<{ data: Sale[] }>(`${environment.apiUrl}/sales`).subscribe({
      next: (response) => {
        this.sales = response.data || [];
        salesLoaded = true;
        if (customersLoaded) this.processData();
      },
      error: () => {
        this.sales = [];
        salesLoaded = true;
        if (customersLoaded) this.processData();
      }
    });
  }

  private processData(): void {
    // Total sales revenue
    this.totalSalesRevenue = this.sales.reduce((sum, s) => {
      const saleTotal = s.total ? parseFloat(s.total.toString()) : (s.fltQuantity * s.fltUnitPrice);
      return sum + saleTotal;
    }, 0);

    // Sales by client (top 5 by revenue)
    const revenueByClient: Record<string, number> = {};
    const countByClient: Record<string, number> = {};
    const productsByClient: Record<string, Record<string, { quantity: number; revenue: number }>> = {};

    this.sales.forEach(sale => {
      const clientName = this.resolveClientName(sale.customerName);
      const saleTotal = sale.total ? parseFloat(sale.total.toString()) : (sale.fltQuantity * sale.fltUnitPrice);

      revenueByClient[clientName] = (revenueByClient[clientName] || 0) + saleTotal;
      countByClient[clientName] = (countByClient[clientName] || 0) + 1;

      const productName = sale.product?.strName || 'Producto desconocido';
      if (!productsByClient[clientName]) productsByClient[clientName] = {};
      if (!productsByClient[clientName][productName]) {
        productsByClient[clientName][productName] = { quantity: 0, revenue: 0 };
      }
      productsByClient[clientName][productName].quantity += parseFloat(sale.fltQuantity.toString());
      productsByClient[clientName][productName].revenue += saleTotal;
    });

    // Top 5 by revenue
    this.salesByClient = Object.entries(revenueByClient)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));

    // Top 5 by purchase count
    this.recurrentClients = Object.entries(countByClient)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Top products by top client
    this.topProductsByClient = [];
    const topClients = Object.entries(revenueByClient)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    topClients.forEach(([clientName]) => {
      const products = productsByClient[clientName] || {};
      const topProduct = Object.entries(products)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 1);

      topProduct.forEach(([productName, data]) => {
        this.topProductsByClient.push({
          customerName: clientName,
          productName,
          totalQuantity: data.quantity,
          totalRevenue: data.revenue
        });
      });
    });

    this.loading = false;
    this.dataReady = true;

    if (this.chartsReady) {
      setTimeout(() => this.renderCharts(), 50);
    }
  }

  private resolveClientName(saleCustomerName: string): string {
    if (!saleCustomerName) return 'Sin cliente';

    // Try to find matching customer in our customer list
    const match = this.customers.find(c => {
      const displayName = this.getCustomerDisplayName(c);
      return displayName.toLowerCase() === saleCustomerName.toLowerCase();
    });

    return match ? this.getCustomerDisplayName(match) : saleCustomerName;
  }

  private getCustomerDisplayName(customer: Customer): string {
    if (customer.businessName) return customer.businessName;
    const parts = [customer.firstName, customer.firstSurname].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : customer.email;
  }

  private renderCharts(): void {
    this.renderSalesByClientChart();
    this.renderRecurrentClientChart();
  }

  private renderSalesByClientChart(): void {
    if (!this.salesByClientChartRef?.nativeElement) return;

    if (this.salesChart) this.salesChart.destroy();

    const ctx = this.salesByClientChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.salesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.salesByClient.map(c => c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name),
        datasets: [{
          label: 'Ingresos',
          data: this.salesByClient.map(c => c.total),
          backgroundColor: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `$ ${(ctx.parsed.x ?? 0).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              callback: (value) => `$${Number(value).toLocaleString()}`
            }
          },
          y: {
            grid: { display: false }
          }
        }
      }
    });
  }

  private renderRecurrentClientChart(): void {
    if (!this.recurrentClientChartRef?.nativeElement) return;

    if (this.recurrentChart) this.recurrentChart.destroy();

    const ctx = this.recurrentClientChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.recurrentChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: this.recurrentClients.map(c => c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name),
        datasets: [{
          data: this.recurrentClients.map(c => c.count),
          backgroundColor: ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 12,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed} compras`
            }
          }
        }
      }
    });
  }
}
