import { Component, EventEmitter, Input, OnInit, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SalesService } from '../../../shared/services/sales.service';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <!-- Header row like materials -->
      <div class="list-header">
        <div class="title-container">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="#6E6E6E">
            <use xlink:href="./assets/icons/bootstrap-icons.svg#speedometer2"></use>
          </svg>
          /Panel de Ventas
        </div>
        <div class="header-actions">
          <a class="action-link action-link-primary" (click)="openCreateModal.emit()" style="cursor:pointer;">
            <svg viewBox="0 0 16 16" width="16" height="16">
              <use xlink:href="./assets/icons/bootstrap-icons.svg#plus-circle"></use>
            </svg>
            Nueva Venta
          </a>
        </div>
      </div>

      <div class="dashboard-content">
        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-icon">
              <svg fill="currentcolor" viewBox="0 0 16 16">
                <use xlink:href="./assets/icons/bootstrap-icons.svg#cart-check"></use>
              </svg>
            </div>
            <div class="stat-content">
              <h3>{{ totalSales }}</h3>
              <p>Total Ventas</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon active">
              <svg fill="currentcolor" viewBox="0 0 16 16">
                <use xlink:href="./assets/icons/bootstrap-icons.svg#currency-dollar"></use>
              </svg>
            </div>
            <div class="stat-content">
              <h3>{{ formatCurrency(totalRevenue) }}</h3>
              <p>Ingresos Totales</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon pending">
              <svg fill="currentcolor" viewBox="0 0 16 16">
                <use xlink:href="./assets/icons/bootstrap-icons.svg#clock"></use>
              </svg>
            </div>
            <div class="stat-content">
              <h3>{{ pendingSales }}</h3>
              <p>Ventas Pendientes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      background: #f8f9fa;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      border-top: 1px solid orange;
      border-bottom: 1px solid orange;
    }

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: white;
      border-bottom: 1px solid #e9ecef;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .title-container {
      display: flex;
      align-items: center;
      font-size: 1rem;
      color: #6E6E6E;
      gap: 0.3rem;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .action-link {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: #6c757d;
      font-weight: 500;
      font-size: 15px;
      text-decoration: none;
      white-space: nowrap;
    }

    .action-link svg {
      width: 15px;
      height: 15px;
      fill: currentColor;
    }

    .action-link.action-link-primary {
      color: #0066cc;
    }

    .action-link.action-link-primary svg {
      fill: #0066cc;
    }

    .action-link.action-link-primary:hover {
      color: #004a99;
    }

    .dashboard-content {
      padding: 1.5rem;
    }
    
    .stats-cards {
      display: flex;
      gap: 1rem;
      flex: 1;
    }
    
    .stat-card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
    }
    
    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #e9ecef;
      color: #6c757d;
    }
    
    .stat-icon.active {
      background: #d4edda;
      color: #155724;
    }
    
    .stat-icon.pending {
      background: #fff3cd;
      color: #856404;
    }
    
    .stat-icon svg {
      width: 24px;
      height: 24px;
    }
    
    .stat-content h3 {
      margin: 0;
      font-size: 2rem;
      font-weight: bold;
      color: #212529;
    }
    
    .stat-content p {
      margin: 0;
      color: #6c757d;
      font-size: 0.875rem;
    }

    @media (max-width: 768px) {
      .dashboard-content {
        padding: 1rem;
      }
      
      .stats-cards {
        flex-direction: column;
      }
      
      .stat-card {
        padding: 1rem;
      }
      
      .stat-content h3 {
        font-size: 1.5rem;
      }
    }
  `]
})
export class SalesDashboardComponent implements OnInit, OnChanges {
  @Input() refreshTrigger = 0;
  @Output() openCreateModal = new EventEmitter<void>();
  
  totalSales = 0;
  totalRevenue = 0;
  pendingSales = 0;

  constructor(private salesService: SalesService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  ngOnChanges(): void {
    if (this.refreshTrigger > 0) {
      this.loadStats();
    }
  }

  loadStats(): void {
    this.salesService.getStats().subscribe({
      next: (stats) => {
        this.totalSales = stats.totalSales || 0;
        this.totalRevenue = stats.totalRevenue || 0;
        this.pendingSales = stats.pendingSales || 0;
      },
      error: () => {
        this.totalSales = 0;
        this.totalRevenue = 0;
        this.pendingSales = 0;
      }
    });
  }

  formatCurrency(value: number): string {
    return '$' + new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
}