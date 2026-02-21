import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductsDashboardComponent } from './dashboard/products-dashboard.component';
import { ProductsListComponent } from './products-list.component';

@Component({
  selector: 'app-products-demo',
  standalone: true,
  imports: [CommonModule, ProductsDashboardComponent, ProductsListComponent],
  template: `
    <div class="demo-container">
      <div class="demo-header">
        <h5 class="mb-0">Gestión de <span class="text-primary fw-bold">PRODUCTOS</span> <span style="color: #ff8000">●</span></h5>
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
          Productos
        </button>
      </div>
      
      <div class="demo-content">
        <app-products-dashboard *ngIf="activeTab === 'dashboard'" (openCreateModal)="showCreateModal()"></app-products-dashboard>
        <app-products-list *ngIf="activeTab === 'list'" #productsList></app-products-list>
      </div>
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
  `]
})
export class ProductsDemoComponent {
  @ViewChild('productsList') productsList?: ProductsListComponent;
  activeTab: 'dashboard' | 'list' = 'dashboard';
  
  showCreateModal() {
    this.activeTab = 'list';
    setTimeout(() => {
      this.productsList?.openCreateModal();
    }, 100);
  }
}
