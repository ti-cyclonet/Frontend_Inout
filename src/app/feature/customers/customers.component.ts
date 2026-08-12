import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CustomersListComponent } from './list/customers-list.component';
import { CustomerFormComponent } from './form/customer-form.component';
import { CustomersDashboardComponent } from './dashboard/customers-dashboard.component';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, RouterModule, CustomersListComponent, CustomerFormComponent, CustomersDashboardComponent],
  templateUrl: './customers.component.html',
  styles: [`
    .customers-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 0.5rem;
    }
    .module-tabs {
      display: flex;
      gap: 0;
      margin-bottom: 1rem;
      border-bottom: 2px solid #e5e7eb;
    }
    .tab {
      padding: 0.6rem 1.5rem;
      border: none;
      background: transparent;
      font-size: 0.85rem;
      font-weight: 500;
      color: #6b7280;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
    }
    .tab.active {
      color: #0066CC;
      border-bottom-color: #0066CC;
      font-weight: 600;
    }
    .tab:hover:not(.active) { color: #374151; }
    .modal { z-index: 1050; }
    .modal-backdrop { z-index: 1040; }
  `]
})
export class CustomersComponent {
  @Input() embedded = false;

  activeTab: 'panel' | 'list' = 'panel';
  showCreateModal = false;
  refreshTrigger = 0;

  onCustomerCreated() {
    this.showCreateModal = false;
    this.refreshTrigger++;
  }
}
