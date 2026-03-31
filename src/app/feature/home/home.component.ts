import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
    sales: []
  };

  loading = true;
  private baseUrl = environment.apiUrl;
  private charts: Chart[] = [];

  constructor(private http: HttpClient) {}

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
      this.http.get<any>(`${this.baseUrl}/sales`).toPromise()
    ]).then(([materials, products, sales]) => {
      this.chartData.materials = materials.data || [];
      this.chartData.products = products.data || [];
      this.chartData.sales = sales.data || [];

      const materialsValue = this.chartData.materials.reduce((sum: number, m: any) => 
        sum + (parseFloat(m.ingQuantity || 0) * parseFloat(m.fltPrice || 0)), 0);
      
      const productsValue = this.chartData.products.reduce((sum: number, p: any) => 
        sum + (parseFloat(p.ingQuantity || 0) * parseFloat(p.fltPrice || 0)), 0);
      
      this.metrics.totalInventoryValue = materialsValue + productsValue;

      this.metrics.totalSales = this.chartData.sales.reduce((sum: number, s: any) => 
        sum + (parseFloat(s.fltQuantity || 0) * parseFloat(s.fltUnitPrice || 0)), 0);

      this.metrics.lowStockProducts = this.chartData.products.filter((p: any) => 
        parseFloat(p.ingQuantity || 0) < parseFloat(p.ingStockMin || 0)).length;

      this.metrics.materialsCount = this.chartData.materials.length;
      this.metrics.productsCount = this.chartData.products.length;
      this.metrics.salesCount = this.chartData.sales.length;

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
      sum + (parseFloat(m.ingQuantity || 0) * parseFloat(m.fltPrice || 0)), 0);
    
    const productsValue = this.chartData.products.reduce((sum: number, p: any) => 
      sum + (parseFloat(p.ingQuantity || 0) * parseFloat(p.fltPrice || 0)), 0);

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
    let salesData: any[] = [];
    
    if (this.chartFilter === 'daily') {
      const currentTenantSales = this.chartData.sales.filter((sale: any) => 
        sale.strTenantId === '3b0fa0d3-4993-4c50-bb38-f7333873b1ca'
      );
      
      const salesByDate = currentTenantSales.reduce((acc: any, sale: any) => {
        const date = new Date(sale.dtmCreationDate);
        const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        const total = parseFloat(sale.total);
        acc[dateStr] = (acc[dateStr] || 0) + total;
        return acc;
      }, {});
      
      salesData = Object.keys(salesByDate).sort((a, b) => {
        const dateA = new Date(a.split('/').reverse().join('-'));
        const dateB = new Date(b.split('/').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
      }).map(date => ({ label: date, value: salesByDate[date] }));
      
    } else if (this.chartFilter === 'weekly') {
      // Agrupar por semana
      const salesByWeek = this.chartData.sales.reduce((acc: any, sale: any) => {
        const date = new Date(sale.dtmDate);
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        const weekLabel = `Semana ${weekStart.toLocaleDateString('es-CO')}`;
        const total = parseFloat(sale.total);
        acc[weekLabel] = (acc[weekLabel] || 0) + total;
        return acc;
      }, {});
      
      salesData = Object.keys(salesByWeek).map(week => ({ 
        label: week, 
        value: salesByWeek[week] 
      }));
      
    } else if (this.chartFilter === 'monthly') {
      // Agrupar por mes
      const salesByMonth = this.chartData.sales.reduce((acc: any, sale: any) => {
        const date = new Date(sale.dtmDate);
        const monthLabel = date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        const total = parseFloat(sale.total);
        acc[monthLabel] = (acc[monthLabel] || 0) + total;
        return acc;
      }, {});
      
      salesData = Object.keys(salesByMonth).map(month => ({ 
        label: month, 
        value: salesByMonth[month] 
      }));
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
    const salesByProduct = this.chartData.sales.reduce((acc: any, sale: any) => {
      const productName = sale.product?.strName || 'Sin producto';
      const total = parseFloat(sale.fltQuantity || 0) * parseFloat(sale.fltUnitPrice || 0);
      acc[productName] = (acc[productName] || 0) + total;
      return acc;
    }, {});

    const sorted = Object.entries(salesByProduct)
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5);

    const chart = new Chart(this.salesChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: sorted.map(([name]) => name),
        datasets: [{
          label: 'Ventas',
          data: sorted.map(([,value]) => Number(value)),
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
            data: materials.map((m: any) => parseFloat(m.ingQuantity || 0) * parseFloat(m.fltPrice || 0)),
            borderColor: '#11998e',
            backgroundColor: 'rgba(17, 153, 142, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2
          },
          {
            label: 'Valor Productos',
            data: [...Array(materials.length).fill(null), ...products.map((p: any) => parseFloat(p.ingQuantity || 0) * parseFloat(p.fltPrice || 0))],
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
    const profitByProduct = this.chartData.sales.reduce((acc: any, sale: any) => {
      const productName = sale.product?.strName || 'Sin producto';
      const revenue = parseFloat(sale.fltQuantity || 0) * parseFloat(sale.fltUnitPrice || 0);
      const cost = parseFloat(sale.fltQuantity || 0) * parseFloat(sale.product?.fltPrice || 0);
      const profit = revenue - cost;
      acc[productName] = (acc[productName] || 0) + profit;
      return acc;
    }, {});

    const sorted = Object.entries(profitByProduct)
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5);

    const chart = new Chart(this.profitChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: sorted.map(([name]) => name),
        datasets: [{
          data: sorted.map(([,value]) => Number(value)),
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
      parseFloat(p.ingQuantity || 0) < parseFloat(p.ingStockMin || 0)).length;
    
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
          window.open(`${environment.apiUrl.replace('/api/inventory', '')}/marketplace/${contract.user.id}?admin=true`, '_blank');
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
