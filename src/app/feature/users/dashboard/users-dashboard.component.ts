import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomersService } from '../../../shared/services/customers.service';
import { CustomerWithDetails } from '../../../shared/model/customer.model';

@Component({
  selector: 'app-users-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-icon">
              <svg fill="currentcolor" viewBox="0 0 16 16">
                <use xlink:href="./assets/icons/bootstrap-icons.svg#people"></use>
              </svg>
            </div>
            <div class="stat-content">
              <h3>{{ totalUsers }}</h3>
              <p>Total de Usuarios</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon active">
              <svg fill="currentcolor" viewBox="0 0 16 16">
                <use xlink:href="./assets/icons/bootstrap-icons.svg#person-check"></use>
              </svg>
            </div>
            <div class="stat-content">
              <h3>{{ activeUsers }}</h3>
              <p>Usuarios Activos</p>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon inactive">
              <svg fill="currentcolor" viewBox="0 0 16 16">
                <use xlink:href="./assets/icons/bootstrap-icons.svg#person-x"></use>
              </svg>
            </div>
            <div class="stat-content">
              <h3>{{ inactiveUsers }}</h3>
              <p>Usuarios Inactivos</p>
            </div>
          </div>
        </div>
        <div class="action-buttons">
          <button class="btn btn-primary" (click)="openCreateModal.emit()">
            <svg fill="currentcolor" viewBox="0 0 16 16">
              <use xlink:href="./assets/icons/bootstrap-icons.svg#person-plus"></use>
            </svg>
            Agregar Usuario
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
    
    .stat-icon.inactive {
      background: #f8d7da;
      color: #721c24;
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
export class UsersDashboardComponent implements OnInit {
  @Input() refreshTrigger = 0;
  @Output() openCreateModal = new EventEmitter<void>();
  
  totalUsers = 0;
  activeUsers = 0;
  inactiveUsers = 0;

  constructor(private customersService: CustomersService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  ngOnChanges(): void {
    if (this.refreshTrigger > 0) {
      this.loadStats();
    }
  }

  loadStats(): void {
    const tenantId = sessionStorage.getItem('tenant_id') || '1';
    
    this.customersService.getCustomersWithDetailsByTenant(tenantId).subscribe({
      next: (customers) => {
        this.totalUsers = customers.length;
        this.activeUsers = customers.filter(c => c.isActive).length;
        this.inactiveUsers = customers.filter(c => !c.isActive).length;
      },
      error: (error) => {
        console.error('Error loading stats:', error);
      }
    });
  }
}