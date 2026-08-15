import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

Chart.register(...registerables);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit, AfterViewInit {
  @ViewChild('inventoryChart') inventoryChartRef!: ElementRef;
  @ViewChild('salesChart') salesChartRef!: ElementRef;
  @ViewChild('stockChart') stockChartRef!: ElementRef;
  @ViewChild('salesTrendChart') salesTrendChartRef!: ElementRef;
  @ViewChild('inventoryTrendChart') inventoryTrendChartRef!: ElementRef;
  @ViewChild('profitChart') profitChartRef!: ElementRef;

  chartFilter = 'daily'; // Filtro por defecto
  salesTrendChart: Chart | null = null;
  private inactivityTimer: any;
  private readonly INACTIVITY_TIME = 30 * 60 * 1000; // 30 minutos

  metrics = {
    totalInventoryValue: 0,
    totalSales: 0,
    totalProductions: 0,
    lowStockProducts: 0,
    materialsCount: 0,
    productsCount: 0,
    salesCount: 0,
    productionsCount: 0
  };

  chartData: any = {
    materials: [],
    products: [],
    salesDaily: [],
    topProducts: []
  };

  loading = true;
  private baseUrl = environment.apiUrl;
  private charts: Chart[] = [];

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadMetrics();
    this.setupInactivityTimer();
  }

  ngAfterViewInit(): void {
    // Los gráficos se crearán después de cargar los datos
  }

  loadMetrics(): void {
    Promise.all([
      this.http.get<any>(`${this.baseUrl}/materials`).toPromise(),
      this.http.get<any>(`${this.baseUrl}/products`).toPromise(),
      this.http.get<any>(`${this.baseUrl}/sales/stats`).toPromise().catch(() => null),
      this.http.get<any>(`${this.baseUrl}/sales/chart-data`).toPromise().catch(() => null)
    ]).then(([materials, products, stats, chartResponse]) => {
      this.chartData.materials = materials.data || materials || [];
      this.chartData.products = products.data || products || [];
      this.chartData.salesDaily = (chartResponse?.daily || []).map((d: any) => ({
        date: d.date,
        total: Number(d.total)
      }));
      this.chartData.topProducts = (chartResponse?.topProducts || []).map((p: any) => ({
        name: p.name,
        total: Number(p.total)
      }));

      const materialsValue = this.chartData.materials.reduce((sum: number, m: any) => 
        sum + (Number(m.ingQuantity || 0) * Number(m.fltPrice || 0)), 0);
      const productsValue = this.chartData.products.reduce((sum: number, p: any) => 
        sum + (Number(p.ingQuantity || 0) * Number(p.fltPrice || 0)), 0);
      
      this.metrics.totalInventoryValue = materialsValue + productsValue;
      this.metrics.totalSales = Number(stats?.totalRevenue || 0);
      this.metrics.salesCount = stats?.totalSales || 0;
      this.metrics.lowStockProducts = this.chartData.products.filter((p: any) => 
        Number(p.ingQuantity || 0) < Number(p.ingStockMin || 0) && Number(p.ingStockMin || 0) > 0).length;
      this.metrics.materialsCount = this.chartData.materials.length;
      this.metrics.productsCount = this.chartData.products.length;

      this.loading = false;
      setTimeout(() => this.createCharts(), 100);
    }).catch(() => {
      this.loading = false;
    });
  }

  createCharts(): void {
    this.createSalesTrendChart();
    this.createInventoryChart();
    this.createSalesChart();
    this.createInventoryTrendChart();
    this.createStockChart();
    this.createProfitChart();
  }

  createInventoryChart(): void {
    const materialsValue = this.chartData.materials.reduce((sum: number, m: any) => 
      sum + (Number(m.ingQuantity || 0) * Number(m.fltPrice || 0)), 0);
    
    const productsValue = this.chartData.products.reduce((sum: number, p: any) => 
      sum + (Number(p.ingQuantity || 0) * Number(p.fltPrice || 0)), 0);

    const chart = new Chart(this.inventoryChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Materiales', 'Productos'],
        datasets: [{
          data: [materialsValue, productsValue],
          backgroundColor: ['#667eea', '#11998e'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
    this.charts.push(chart);
  }

  onFilterChange(filter: string): void {
    this.chartFilter = filter;
    if (this.salesTrendChart) {
      this.salesTrendChart.destroy();
    }
    setTimeout(() => this.createSalesTrendChart(), 100);
  }

  createSalesTrendChart(): void {
    // Usar datos pre-procesados del backend (ya agrupados por día)
    const dailyData = this.chartData.salesDaily || [];
    
    let salesData: any[] = [];
    
    if (this.chartFilter === 'daily') {
      salesData = dailyData.map((d: any) => {
        const date = new Date(d.date + 'T12:00:00');
        return { label: `${date.getDate()}/${date.getMonth() + 1}`, value: d.total };
      });
    } else if (this.chartFilter === 'weekly') {
      const weekMap: Record<string, number> = {};
      for (const d of dailyData) {
        const date = new Date(d.date + 'T12:00:00');
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekLabel = `Sem ${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
        weekMap[weekLabel] = (weekMap[weekLabel] || 0) + d.total;
      }
      salesData = Object.entries(weekMap).map(([label, value]) => ({ label, value }));
    } else if (this.chartFilter === 'monthly') {
      const monthMap: Record<string, number> = {};
      for (const d of dailyData) {
        const date = new Date(d.date + 'T12:00:00');
        const monthLabel = date.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
        monthMap[monthLabel] = (monthMap[monthLabel] || 0) + d.total;
      }
      salesData = Object.entries(monthMap).map(([label, value]) => ({ label, value }));
    }
    
    if (salesData.length === 0) {
      salesData = [{ label: 'Sin ventas', value: 0 }];
    }
    
    this.salesTrendChart = new Chart(this.salesTrendChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: salesData.map(item => item.label),
        datasets: [{
          label: 'Ingresos por Ventas',
          data: salesData.map(item => item.value),
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            callbacks: {
              label: (context) => `Ventas: ${this.formatCurrency(context.parsed.y || 0)}`
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: true,
            ticks: {
              callback: (value) => this.formatCurrency(Number(value))
            }
          }
        }
      }
    });
    this.charts.push(this.salesTrendChart);
  }

  createSalesChart(): void {
    const topProducts = this.chartData.topProducts || [];
    
    if (topProducts.length === 0) return;

    const chart = new Chart(this.salesChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: topProducts.map((p: any) => p.name),
        datasets: [{
          label: 'Ventas',
          data: topProducts.map((p: any) => p.total),
          backgroundColor: ['#667eea', '#11998e', '#38ef7d', '#4facfe', '#f5576c'],
          borderRadius: 8,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Ventas: ${this.formatCurrency(context.parsed.y || 0)}`
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: true,
            ticks: {
              callback: (value) => this.formatCurrency(Number(value))
            }
          }
        }
      }
    });
    this.charts.push(chart);
  }

  createInventoryTrendChart(): void {
    const materials = this.chartData.materials.slice(0, 10);
    const products = this.chartData.products.slice(0, 10);
    const allItems = [...materials, ...products];
    const itemNames = allItems.map((item: any, index: number) => `${index + 1} - ${item.strName}`);

    const chart = new Chart(this.inventoryTrendChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: allItems.map((item: any, index: number) => (index + 1).toString()),
        datasets: [
          {
            label: 'Valor Materiales',
            data: materials.map((m: any) => Number(m.ingQuantity || 0) * Number(m.fltPrice || 0)),
            borderColor: '#11998e',
            backgroundColor: 'rgba(17, 153, 142, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2
          },
          {
            label: 'Valor Productos',
            data: [...Array(materials.length).fill(null), ...products.map((p: any) => Number(p.ingQuantity || 0) * Number(p.fltPrice || 0))],
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            callbacks: {
              title: (context) => itemNames[context[0].dataIndex],
              label: (context) => `${context.dataset.label}: ${this.formatCurrency(context.parsed.y || 0)}`
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: true,
            ticks: {
              callback: (value) => this.formatCurrency(Number(value))
            }
          }
        }
      }
    });
    this.charts.push(chart);
  }

  createProfitChart(): void {
    const topProducts = this.chartData.topProducts || [];
    
    if (topProducts.length === 0) return;

    const chart = new Chart(this.profitChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: topProducts.map((p: any) => p.name),
        datasets: [{
          data: topProducts.map((p: any) => p.total),
          backgroundColor: ['#667eea', '#11998e', '#38ef7d', '#4facfe', '#f5576c'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${this.formatCurrency(Number(context.parsed))}`
            }
          }
        }
      }
    });
    this.charts.push(chart);
  }

  createStockChart(): void {
    const lowStock = this.chartData.products.filter((p: any) => 
      Number(p.ingQuantity || 0) < Number(p.ingStockMin || 0) && Number(p.ingStockMin || 0) > 0).length;
    
    const normalStock = this.chartData.products.length - lowStock;

    const chart = new Chart(this.stockChartRef.nativeElement, {
      type: 'pie',
      data: {
        labels: ['Stock Normal', 'Stock Bajo'],
        datasets: [{
          data: [normalStock, lowStock],
          backgroundColor: ['#4facfe', '#f5576c'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
    this.charts.push(chart);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-CO').format(value);
  }

  ngOnDestroy(): void {
    this.charts.forEach(chart => chart.destroy());
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
  }

  openSettings(): void {
    this.router.navigate(['/setting']);
  }

  openMarketplace(): void {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Sesión Expirada',
        text: 'Por favor, inicia sesión nuevamente.'
      });
      return;
    }
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const tenantId = payload.tenantId || payload.basicDataId;
      
      this.http.get<any>(`${environment.auth.authorizaUrl}/contracts/tenant/${tenantId}`).toPromise()
        .then(contract => {
          window.open(`/marketplace/${contract.user.id}?admin=true`, '_blank');
        })
        .catch(error => {
          console.error('Error al obtener contrato:', error);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se encontró un contrato para este usuario'
          });
        });
    } catch (error) {
      console.error('Error al decodificar token:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al procesar la sesión'
      });
    }
  }

  private setupInactivityTimer(): void {
    this.resetInactivityTimer();
    
    // Eventos que resetean el timer
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, () => this.resetInactivityTimer(), true);
    });
  }

  private resetInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    
    this.inactivityTimer = setTimeout(() => {
      this.logout();
    }, this.INACTIVITY_TIME);
  }

  private logout(): void {
    localStorage.removeItem('token');
    alert('Sesión cerrada por inactividad');
    window.location.href = '/login';
  }
}
