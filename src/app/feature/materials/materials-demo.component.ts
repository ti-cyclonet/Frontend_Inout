import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialsDashboardComponent } from './dashboard/materials-dashboard.component';
import { MaterialsListComponent } from './list/materials-list.component';
import { MaterialFormComponent } from './form/material-form.component';
import { MaterialCompositionComponent } from './composition/material-composition.component';

@Component({
  selector: 'app-materials-demo',
  standalone: true,
  imports: [CommonModule, MaterialsDashboardComponent, MaterialsListComponent, MaterialFormComponent, MaterialCompositionComponent],
  template: `
    <div class="demo-container">
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
          Materiales
        </button>
        <button 
          class="tab-button" 
          [class.active]="activeTab === 'composition'"
          (click)="activeTab = 'composition'">
          Materiales Compuestos
        </button>
      </div>
      
      <div class="demo-content">
        <app-materials-dashboard *ngIf="activeTab === 'dashboard'" [refreshTrigger]="refreshTrigger" (openCreateModal)="showCreateModal = true" (openCompositionModal)="openCompositionModal()"></app-materials-dashboard>
        <app-materials-list *ngIf="activeTab === 'list'" [refreshTrigger]="refreshTrigger" (openCreateModal)="showCreateModal = true"></app-materials-list>
        <app-material-composition *ngIf="activeTab === 'composition'" [externalModalControl]="showCompositionModal"></app-material-composition>
      </div>
      
      <!-- Modal para crear material -->
      <div class="modal fade" [class.show]="showCreateModal" [style.display]="showCreateModal ? 'block' : 'none'" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Crear Material</h5>
              <button type="button" class="btn-close" (click)="showCreateModal = false"></button>
            </div>
            <div class="modal-body">
              <app-material-form [isModal]="true" (materialCreated)="onMaterialCreated()" (formCancelled)="showCreateModal = false"></app-material-form>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade" [class.show]="showCreateModal" *ngIf="showCreateModal" (click)="showCreateModal = false"></div>
    </div>
  `,
  styles: [`
    .demo-container {
      height: 100%;
      display: flex;
      flex-direction: column;
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
      overflow: hidden;
    }
    
    .modal {
      z-index: 1050;
    }
    
    .modal-backdrop {
      z-index: 1040;
    }
  `]
})
export class MaterialsDemoComponent {
  activeTab: 'dashboard' | 'list' | 'composition' = 'dashboard';
  showCreateModal = false;
  showCompositionModal = false;
  refreshTrigger = 0;
  
  onMaterialCreated() {
    this.showCreateModal = false;
    this.refreshTrigger++; // Trigger refresh
  }
  
  openCompositionModal() {
    this.activeTab = 'composition';
    // Usar setTimeout para asegurar que el componente se renderice antes de abrir la modal
    setTimeout(() => {
      this.showCompositionModal = true;
    }, 100);
  }
}