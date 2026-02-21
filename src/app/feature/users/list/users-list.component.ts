import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomersService } from '../../../shared/services/customers.service';
import { CustomerWithDetails } from '../../../shared/model/customer.model';
import { UserFormComponent } from '../form/user-form.component';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule, UserFormComponent],
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css']
})
export class UsersListComponent implements OnInit {
  @Input() refreshTrigger = 0;
  
  users: CustomerWithDetails[] = [];
  filteredUsers: CustomerWithDetails[] = [];
  loading = false;
  searchTerm = '';
  showCreateModal = false;

  constructor(private customersService: CustomersService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  ngOnChanges(): void {
    if (this.refreshTrigger > 0) {
      this.loadUsers();
    }
  }

  loadUsers(): void {
    this.loading = true;
    const tenantId = sessionStorage.getItem('tenant_id') || '1';
    
    this.customersService.getCustomersWithDetailsByTenant(tenantId).subscribe({
      next: (users) => {
        this.users = users;
        this.filteredUsers = users;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.loading = false;
      }
    });
  }

  filterUsers(): void {
    if (!this.searchTerm) {
      this.filteredUsers = this.users;
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredUsers = this.users.filter(user => 
      user.userDetails?.strFirstName?.toLowerCase().includes(term) ||
      user.userDetails?.strLastName?.toLowerCase().includes(term) ||
      user.userDetails?.strEmail?.toLowerCase().includes(term) ||
      user.userId.toLowerCase().includes(term)
    );
  }

  removeUser(id: string): void {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      this.customersService.removeCustomer(id).subscribe({
        next: () => {
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error removing user:', error);
        }
      });
    }
  }

  onUserCreated(): void {
    this.showCreateModal = false;
    this.loadUsers();
  }
}