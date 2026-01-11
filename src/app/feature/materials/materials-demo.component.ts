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
          Lista de Materiales
        </button>
        <button 
          class="tab-button" 
          [class.active]="activeTab === 'form'"
          (click)="activeTab = 'form'">
          Crear Material
        </button>
        <button 
          class="tab-button" 
          [class.active]="activeTab === 'composition'"
          (click)="activeTab = 'composition'">
          Composición
        </button>
      </div>
      
      <div class="demo-content">
        <app-materials-dashboard *ngIf="activeTab === 'dashboard'"></app-materials-dashboard>
        <app-materials-list *ngIf="activeTab === 'list'"></app-materials-list>
        <app-material-form *ngIf="activeTab === 'form'"></app-material-form>
        <app-material-composition *ngIf="activeTab === 'composition'"></app-material-composition>
      </div>
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
  `]
})
export class MaterialsDemoComponent {
  activeTab: 'dashboard' | 'list' | 'form' | 'composition' = 'dashboard';
}