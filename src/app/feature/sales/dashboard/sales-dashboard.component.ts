import { Component, EventEmitter, Input, OnInit, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SalesService } from '../../../shared/services/sales.service';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <div class="dashboard-header">
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
        <div class="action-buttons">
          <button class="btn btn-primary" (click)="openCreateModal.emit()">
            <svg fill="currentcolor" viewBox="0 0 16 16">
              <use xlink:href="./assets/icons/bootstrap-icons.svg#plus-circle"></use>
            </svg>
            Nueva Venta
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 1.5rem;
      background: #f8f9fa;
      min-height: 100%;
    }
    
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 2rem;
      margin-bottom: 2rem;
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
    
    .action-buttons {
      display: flex;
      gap: 1rem;
    }
    
    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
    }
    
    .btn-primary {
      background: #007bff;
      color: white;
    }
    
    .btn-primary:hover {
      background: #0056b3;
    }
    
    .btn svg {
      width: 16px;
      height: 16px;
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