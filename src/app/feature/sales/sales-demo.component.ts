import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SalesDashboardComponent } from './dashboard/sales-dashboard.component';
import { SalesListComponent } from './list/sales-list.component';
import { SaleFormComponent } from './form/sale-form.component';
import { CustomersComponent } from '../customers/customers.component';

@Component({
  selector: 'app-sales-demo',
  standalone: true,
  imports: [CommonModule, SalesDashboardComponent, SalesListComponent, SaleFormComponent, CustomersComponent],
  template: `
    <div class="demo-container">
      <div class="demo-header">
        <h5 class="mb-0">Gestión de <span class="text-primary fw-bold">VENTAS</span> <span style="color: #ff8000">●</span></h5>
      </div>
      <div class="demo-tabs">
        <button 
          class="tab-button" 
          [class.active]="activeTab === 'dashboard'"
          (click)="activeTab = 'dashboard'">
          Panel
        </button>
        <button 
          class="tab-button" 
          [class.active]="activeTab === 'list'"
          (click)="activeTab = 'list'">
          Ventas
        </button>
        <button 
          class="tab-button" 
          [class.active]="activeTab === 'customers'"
          (click)="activeTab = 'customers'">
          Clientes
        </button>
      </div>
      
      <div class="demo-content">
        <app-sales-dashboard *ngIf="activeTab === 'dashboard'" [refreshTrigger]="refreshTrigger" (openCreateModal)="showCreateModal = true"></app-sales-dashboard>
        <app-sales-list *ngIf="activeTab === 'list'" [refreshTrigger]="refreshTrigger" (openCreateModal)="showCreateModal = true"></app-sales-list>
        <app-customers *ngIf="activeTab === 'customers'"></app-customers>
      </div>
      
      <!-- Modal para crear venta -->
      <div class="modal fade" [class.show]="showCreateModal" [style.display]="showCreateModal ? 'block' : 'none'" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-body p-0">
              <app-sale-form [isModal]="true" (saleCreated)="onSaleCreated()" (formCancelled)="showCreateModal = false"></app-sale-form>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade" [class.show]="showCreateModal" *ngIf="showCreateModal"></div>
    </div>
  `,
  styles: [`
    .demo-container {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    
    .demo-header {
      background: white;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid orange;
      text-align: right;
    }
    
    .demo-tabs {
      display: flex;
      background: white;
      border-bottom: 1px solid #e9ecef;
      padding: 0 1rem;
    }
    
    .tab-button {
      padding: 1rem 1.5rem;
      border: none;
      background: transparent;
      color: #6c757d;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
    }
    
    .tab-button:hover {
      color: #007bff;
    }
    
    .tab-button.active {
      color: #007bff;
      border-bottom-color: #007bff;
    }
    
    .demo-content {
      flex: 1;
      overflow: auto;
    }
    
    .modal {
      z-index: 1050;
    }
    
    .modal-backdrop {
      z-index: 1040;
    }
  `]
})
export class SalesDemoComponent {
  activeTab: 'dashboard' | 'list' | 'customers' = 'dashboard';
  showCreateModal = false;
  refreshTrigger = 0;
  
  constructor(private route: ActivatedRoute) {}
  
  onSaleCreated() {
    this.showCreateModal = false;
    this.refreshTrigger++; // Trigger refresh
  }
}