import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { UsersDashboardComponent } from './dashboard/users-dashboard.component';
import { UsersListComponent } from './list/users-list.component';
import { UserFormComponent } from './form/user-form.component';

@Component({
  selector: 'app-users-demo',
  standalone: true,
  imports: [CommonModule, UsersDashboardComponent, UsersListComponent, UserFormComponent],
  template: `
    <div class="demo-container">
      <div class="demo-header">
        <h5 class="mb-0">Gestión de <span class="text-primary fw-bold">USUARIOS</span> <span style="color: #ff8000">●</span></h5>
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
          Usuarios
        </button>
      </div>
      
      <div class="demo-content">
        <app-users-dashboard *ngIf="activeTab === 'dashboard'" [refreshTrigger]="refreshTrigger" (openCreateModal)="showCreateModal = true"></app-users-dashboard>
        <app-users-list *ngIf="activeTab === 'list'" [refreshTrigger]="refreshTrigger"></app-users-list>
      </div>
      
      <app-user-form *ngIf="showCreateModal" (userCreated)="onUserCreated()" (formCancelled)="showCreateModal = false"></app-user-form>
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
    
    app-user-form {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1050;
    }
  `]
})
export class UsersDemoComponent {
  activeTab: 'dashboard' | 'list' = 'dashboard';
  refreshTrigger = 0;
  showCreateModal = false;
  
  constructor(private route: ActivatedRoute) {}
  
  onUserCreated() {
    this.showCreateModal = false;
    this.refreshTrigger++;
  }
}