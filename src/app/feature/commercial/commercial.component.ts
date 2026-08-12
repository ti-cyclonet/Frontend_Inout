import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesDashboardComponent } from '../sales/dashboard/sales-dashboard.component';
import { SalesListComponent } from '../sales/list/sales-list.component';
import { SaleFormComponent } from '../sales/form/sale-form.component';
import { OrdersComponent } from '../orders/orders.component';
import { CustomersComponent } from '../customers/customers.component';

@Component({
  selector: 'app-commercial',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SalesDashboardComponent,
    SalesListComponent,
    SaleFormComponent,
    OrdersComponent,
    CustomersComponent
  ],
  template: `
    <div class="commercial-container">
      <div class="commercial-header">
        <h5 class="mb-0">Módulo <span class="text-primary fw-bold">COMERCIAL</span> <span style="color: #ff8000">●</span></h5>
      </div>
      <div class="commercial-tabs">
        <button class="tab-button" [class.active]="activeTab === 'dashboard'" (click)="activeTab = 'dashboard'">
          Panel
        </button>
        <button class="tab-button" [class.active]="activeTab === 'sales'" (click)="activeTab = 'sales'">
          Ventas Directas
        </button>
        <button class="tab-button" [class.active]="activeTab === 'orders'" (click)="activeTab = 'orders'">
          Pedidos
        </button>
        <button class="tab-button" [class.active]="activeTab === 'customers'" (click)="activeTab = 'customers'">
          Clientes
        </button>
      </div>

      <div class="commercial-content">
        <!-- Panel: Resumen de ventas -->
        <div *ngIf="activeTab === 'dashboard'">
          <app-sales-dashboard [refreshTrigger]="refreshTrigger" (openCreateModal)="openSaleModal()" (openOrderModal)="goToOrders()" (openCustomerTab)="goToCustomers()"></app-sales-dashboard>
        </div>

        <!-- Ventas Directas -->
        <div *ngIf="activeTab === 'sales'">
          <app-sales-list [refreshTrigger]="refreshTrigger" (openCreateModal)="openSaleModal()"></app-sales-list>
        </div>

        <!-- Pedidos -->
        <div *ngIf="activeTab === 'orders'">
          <app-orders></app-orders>
        </div>

        <!-- Clientes -->
        <div *ngIf="activeTab === 'customers'">
          <app-customers [embedded]="true"></app-customers>
        </div>
      </div>

      <!-- Modal para crear venta directa -->
      <div class="modal fade" [class.show]="showSaleModal" [style.display]="showSaleModal ? 'block' : 'none'" tabindex="-1">
        <div class="modal-dialog modal-xl">
          <div class="modal-content">
            <div class="modal-body p-0">
              <app-sale-form [isModal]="true" (saleCreated)="onSaleCreated()" (formCancelled)="showSaleModal = false"></app-sale-form>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade" [class.show]="showSaleModal" *ngIf="showSaleModal"></div>
    </div>
  `,
  styles: [`
    .commercial-container {
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .commercial-header {
      background: white;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid orange;
      text-align: right;
    }

    .commercial-tabs {
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
      white-space: nowrap;
    }

    .tab-button:hover { color: #007bff; }
    .tab-button.active { color: #007bff; border-bottom-color: #007bff; }

    @media (max-width: 576px) {
      .commercial-tabs { padding: 0 0.25rem; }
      .tab-button { padding: 0.75rem 0.6rem; font-size: 0.78rem; }
    }

    .commercial-content {
      flex: 1;
      overflow: auto;
    }

    .modal { z-index: 1060; }
    .modal-backdrop { z-index: 1055; }
  `]
})
export class CommercialComponent {
  activeTab: 'dashboard' | 'sales' | 'orders' | 'customers' = 'dashboard';
  showSaleModal = false;
  refreshTrigger = 0;

  openSaleModal(): void {
    this.showSaleModal = true;
  }

  onSaleCreated(): void {
    this.showSaleModal = false;
    this.refreshTrigger++;
  }

  goToOrders(): void {
    this.activeTab = 'orders';
  }

  goToCustomers(): void {
    this.activeTab = 'customers';
  }
}
