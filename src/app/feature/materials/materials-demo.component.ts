import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MaterialsDashboardComponent } from './dashboard/materials-dashboard.component';
import { MaterialsListComponent } from './list/materials-list.component';
import { MaterialFormComponent } from './form/material-form.component';
import { MaterialCompositionComponent } from './composition/material-composition.component';
import { BulkEntryComponent } from '../kardex/bulk-entry/bulk-entry.component';

@Component({
  selector: 'app-materials-demo',
  standalone: true,
  imports: [CommonModule, MaterialsDashboardComponent, MaterialsListComponent, MaterialFormComponent, MaterialCompositionComponent, BulkEntryComponent],
  template: `
    <div class="demo-container">
      <div class="demo-header">
        <h5 class="mb-0">Gestión de <span class="text-primary fw-bold">MATERIALES</span> <span style="color: #ff8000">●</span></h5>
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
          Materiales
        </button>
        <button 
          *ngIf="isManufacturing"
          class="tab-button" 
          [class.active]="activeTab === 'composition'"
          (click)="activeTab = 'composition'">
          Materiales Compuestos
        </button>
        <button 
          class="tab-button" 
          [class.active]="activeTab === 'bulk-entry'"
          (click)="activeTab = 'bulk-entry'">
          Registro de Compras
        </button>
      </div>
      
      <div class="demo-content">
        <app-materials-dashboard *ngIf="activeTab === 'dashboard'" [refreshTrigger]="refreshTrigger" (openCreateModal)="showCreateModal = true" (openCompositionModal)="openCompositionModal()" (refreshList)="onMaterialCreated()"></app-materials-dashboard>
        <app-materials-list *ngIf="activeTab === 'list'" [refreshTrigger]="refreshTrigger" (openCreateModal)="showCreateModal = true" (openEditModal)="openEditModal($event)"></app-materials-list>
        <app-material-composition *ngIf="activeTab === 'composition' && isManufacturing" [externalModalControl]="showCompositionModal" [editMaterialId]="editMaterialId" [initialStep]="initialStep"></app-material-composition>
        <app-bulk-entry *ngIf="activeTab === 'bulk-entry'"></app-bulk-entry>
      </div>
      
      <!-- Modal para crear material -->
      <div class="modal fade" [class.show]="showCreateModal" [style.display]="showCreateModal ? 'block' : 'none'" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-body">
              <app-material-form [isModal]="true" [materialId]="editingMaterialId" (materialCreated)="onMaterialCreated()" (formCancelled)="closeModal()"></app-material-form>
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
      white-space: nowrap;
    }
    
    .tab-button:hover {
      color: #007bff;
    }
    
    .tab-button.active {
      color: #007bff;
      border-bottom-color: #007bff;
    }

    @media (max-width: 650px) {
      .demo-tabs {
        padding: 0 0.25rem;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .tab-button {
        padding: 0.75rem 0.6rem;
        font-size: 12px;
        white-space: nowrap;
      }
    }
    
    .demo-content {
      flex: 1;
      overflow: auto;
    }
    
    .modal {
      z-index: 1060;
    }
    
    .modal-backdrop {
      z-index: 1055;
    }
  `]
})
export class MaterialsDemoComponent implements OnInit {
  activeTab: 'dashboard' | 'list' | 'composition' | 'bulk-entry' = 'dashboard';
  showCreateModal = false;
  showCompositionModal = false;
  refreshTrigger = 0;
  editMaterialId: string | null = null;
  editingMaterialId: number | undefined = undefined;
  initialStep: number = 1;

  get isManufacturing(): boolean {
    return sessionStorage.getItem('selectedModule') === 'manufacturing';
  }
  
  constructor(private route: ActivatedRoute) {}
  
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['edit'] && params['step']) {
        this.editMaterialId = params['edit'];
        this.initialStep = parseInt(params['step']);
        this.activeTab = 'composition';
        setTimeout(() => {
          this.showCompositionModal = true;
        }, 100);
      }
    });
  }
  
  onMaterialCreated() {
    this.showCreateModal = false;
    this.editingMaterialId = undefined;
    this.refreshTrigger++;
  }
  
  openEditModal(material: any) {
    this.editingMaterialId = material.id;
    this.showCreateModal = true;
  }
  
  closeModal() {
    this.showCreateModal = false;
    this.editingMaterialId = undefined;
  }
  
  openCompositionModal() {
    this.activeTab = 'composition';
    // Usar setTimeout para asegurar que el componente se renderice antes de abrir la modal
    setTimeout(() => {
      this.showCompositionModal = true;
    }, 100);
  }
}