import { Component, EventEmitter, Input, OnInit, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomersService } from '../../../shared/services/customers.service';
import { CustomerWithDetails } from '../../../shared/model/customer.model';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';

@Component({
  selector: 'app-users-dashboard',
  standalone: true,
  imports: [CommonModule, MetricCardComponent],
  template: `
    <div class="dashboard-wrapper" style="height: 100%;">
      <!-- Subtitle and buttons row -->
      <div class="page-subtitle-row" style="border-top: 1px solid orange">
        <div class="page-subtitle">
          <svg viewBox="0 0 16 16">
            <use xlink:href="./assets/icons/bootstrap-icons.svg#speedometer2" />
          </svg>
          /Panel Principal
        </div>

        <div class="header-actions">
          <a class="action-link action-link-primary" (click)="openCreateModal.emit()" style="cursor:pointer;">
            <svg viewBox="0 0 16 16" width="16" height="16">
              <use xlink:href="./assets/icons/bootstrap-icons.svg#person-plus" />
            </svg>
            Usuario
          </a>
        </div>
      </div>

      <div class="dashboard-container" style="border-bottom: 1px solid orange;">
        <div class="row g-4">
          <div class="col-md-4">
            <app-metric-card
              [value]="totalUsers"
              [label]="'Total Usuarios'"
              [icon]="'people'"
              [cardClass]="'card-primary'"
            ></app-metric-card>
          </div>
          <div class="col-md-4">
            <app-metric-card
              [value]="activeUsers"
              [label]="'Usuarios Activos'"
              [icon]="'person-check'"
              [cardClass]="'card-success'"
            ></app-metric-card>
          </div>
          <div class="col-md-4">
            <app-metric-card
              [value]="inactiveUsers"
              [label]="'Usuarios Inactivos'"
              [icon]="'person-x'"
              [cardClass]="'card-warning'"
            ></app-metric-card>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-wrapper {
      background: #f8f9fa;
    }

    .page-subtitle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1.5rem;
      background: white;
      border-bottom: 1px solid #e9ecef;
    }

    .page-subtitle {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.78rem;
      color: #6E6E6E;
    }

    .page-subtitle svg {
      width: 16px;
      height: 16px;
      fill: #6E6E6E;
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
      font-size: 15px;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      border-bottom: 1px solid transparent;
      padding: 0.25rem 0;
      transition: color 0.2s ease, border-color 0.2s ease;
    }

    .action-link svg {
      width: 15px;
      height: 15px;
      fill: #6c757d;
      flex-shrink: 0;
    }

    .action-link.action-link-primary {
      color: #0066cc;
    }

    .action-link.action-link-primary svg {
      fill: #0066cc;
    }

    .action-link.action-link-primary:hover {
      color: #004a99;
      border-bottom-color: #004a99;
    }

    .dashboard-container {
      padding: 1.5rem;
    }
  `]
})
export class UsersDashboardComponent implements OnInit, OnChanges {
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
    this.customersService.getCustomersWithDetails().subscribe({
      next: (customers: CustomerWithDetails[]) => {
        this.totalUsers = customers.length;
        this.activeUsers = customers.filter((c: CustomerWithDetails) => c.isActive).length;
        this.inactiveUsers = customers.filter((c: CustomerWithDetails) => !c.isActive).length;
      },
      error: (error: unknown) => {
        console.error('Error loading stats:', error);
      }
    });
  }
}
