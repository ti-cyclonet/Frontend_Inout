import { Component, OnInit, Output, EventEmitter, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CustomersListComponent } from './list/customers-list.component';
import { CustomerFormComponent } from './form/customer-form.component';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, RouterModule, CustomersListComponent, CustomerFormComponent],
  template: `
    <div class="customers-demo-container">
      <app-customers-list 
        [refreshTrigger]="refreshTrigger" 
        (openCreateModal)="showCreateModal = true">
      </app-customers-list>
      
      <!-- Modal para crear cliente -->
      <div class="modal fade" [class.show]="showCreateModal" [style.display]="showCreateModal ? 'block' : 'none'" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-body">
              <app-customer-form 
                [isModal]="true" 
                (customerCreated)="onCustomerCreated()" 
                (formCancelled)="showCreateModal = false">
              </app-customer-form>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade" [class.show]="showCreateModal" *ngIf="showCreateModal"></div>
    </div>
  `,
  styles: [`
    .customers-demo-container {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    
    .modal {
      z-index: 1050;
    }
    
    .modal-backdrop {
      z-index: 1040;
    }
  `]
})
export class CustomersComponent {
  showCreateModal = false;
  refreshTrigger = 0;
  
  onCustomerCreated() {
    this.showCreateModal = false;
    this.refreshTrigger++; // Trigger refresh
  }
}