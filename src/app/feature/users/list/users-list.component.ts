import { Component, Input, OnInit, OnChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomersService } from '../../../shared/services/customers.service';
import { CustomerWithDetails } from '../../../shared/model/customer.model';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css']
})
export class UsersListComponent implements OnInit, OnChanges {
  @Input() refreshTrigger = 0;
  @Output() openCreateModal = new EventEmitter<void>();

  users: CustomerWithDetails[] = [];
  filteredUsers: CustomerWithDetails[] = [];
  loading = false;
  showFilters = false;

  // Filters
  searchTerm = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  personTypeFilter: 'all' | 'N' | 'J' = 'all';

  // Pagination
  currentPage = 1;
  pageSize = 6;
  totalItems = 0;
  totalPages = 0;
  pageSizeOptions = [6, 12, 18, 30];

  // Sorting
  sortField = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  Math = Math;

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
        this.applyFilters();
        this.loading = false;
      },
      error: (error: unknown) => {
        console.error('Error loading users:', error);
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    let result = [...this.users];

    // Search
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(user =>
        user.firstName?.toLowerCase().includes(term) ||
        user.firstSurname?.toLowerCase().includes(term) ||
        user.businessName?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.documentNumber?.toLowerCase().includes(term) ||
        user.customerCode?.toLowerCase().includes(term) ||
        user.phone?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (this.statusFilter === 'active') {
      result = result.filter(u => u.isActive);
    } else if (this.statusFilter === 'inactive') {
      result = result.filter(u => !u.isActive);
    }

    // Person type filter
    if (this.personTypeFilter !== 'all') {
      result = result.filter(u => u.personType === this.personTypeFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let valA = '';
      let valB = '';
      if (this.sortField === 'name') {
        valA = (a.personType === 'J' ? a.businessName : `${a.firstName} ${a.firstSurname}`) || '';
        valB = (b.personType === 'J' ? b.businessName : `${b.firstName} ${b.firstSurname}`) || '';
      } else if (this.sortField === 'email') {
        valA = a.email || '';
        valB = b.email || '';
      } else if (this.sortField === 'date') {
        valA = a.createdAt?.toString() || '';
        valB = b.createdAt?.toString() || '';
      }
      const cmp = valA.localeCompare(valB);
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });

    // Pagination
    this.totalItems = result.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    if (this.currentPage > this.totalPages) this.currentPage = 1;

    const start = (this.currentPage - 1) * this.pageSize;
    this.filteredUsers = result.slice(start, start + this.pageSize);
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.applyFilters();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.personTypeFilter = 'all';
    this.currentPage = 1;
    this.applyFilters();
  }

  getUserName(user: CustomerWithDetails): string {
    if (user.personType === 'J') {
      return user.businessName || 'Sin nombre';
    }
    return [user.firstName, user.firstSurname].filter(Boolean).join(' ') || 'Sin nombre';
  }

  removeUser(id: string): void {
    if (confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      this.customersService.removeCustomer(id).subscribe({
        next: () => this.loadUsers(),
        error: (error: unknown) => console.error('Error removing user:', error)
      });
    }
  }
}
