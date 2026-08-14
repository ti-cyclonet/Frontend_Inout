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
    
    this.customersService.getCustomersWithDetails().subscribe({
      next: (users: CustomerWithDetails[]) => {
        this.users = users;
        this.filteredUsers = users;
        this.loading = false;
      },
      error: (error: unknown) => {
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
      user.firstName?.toLowerCase().includes(term) ||
      user.firstSurname?.toLowerCase().includes(term) ||
      user.businessName?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.documentNumber?.toLowerCase().includes(term) ||
      user.customerCode?.toLowerCase().includes(term)
    );
  }

  removeUser(id: string): void {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      this.customersService.removeCustomer(id).subscribe({
        next: () => {
          this.loadUsers();
        },
        error: (error: unknown) => {
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