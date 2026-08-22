import { Component, Input, OnInit, OnChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { CustomersService } from '../../../shared/services/customers.service';
import { CustomerWithDetails } from '../../../shared/model/customer.model';
import Swal from 'sweetalert2';

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
  viewMode: 'table' | 'cards' = 'table';

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

  // Detail modal
  showDetailModal = false;
  selectedUser: CustomerWithDetails | null = null;
  selectedUserRole = '';
  originalUserRole = '';
  selectedUserSigner = false;
  savingRole = false;
  availableRoles: any[] = [];
  contractId: string | null = null;
  private selectedUserAuthorizaId: string | null = null;

  Math = Math;

  constructor(private customersService: CustomersService) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
  }

  ngOnChanges(): void {
    if (this.refreshTrigger > 0) {
      this.loadUsers();
    }
  }

  loadRoles(): void {
    // Get tenantId from JWT token (the contract owner)
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
    if (!token) return;
    
    let tenantId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      tenantId = payload.tenantId || payload.basicDataId || null;
    } catch { return; }
    
    if (!tenantId) return;

    this.customersService.getTenantContract(tenantId).subscribe({
      next: (data: any) => {
        this.contractId = data.contractId;
        if (this.contractId) {
          this.customersService.getRoleAvailability(this.contractId).subscribe({
            next: (roles: any[]) => {
              // Show all roles with available slots
              this.availableRoles = roles;
            },
            error: () => {}
          });
        }
      },
      error: () => {}
    });
  }

  openUserDetail(user: CustomerWithDetails): void {
    this.selectedUser = user;
    this.selectedUserRole = '';
    this.originalUserRole = '';
    this.selectedUserSigner = false;
    this.selectedUserAuthorizaId = null;
    this.showDetailModal = true;

    // Load current role: first get Authoriza userId, then fetch their roles
    if (user.email) {
      this.customersService.checkEmailExists(user.email).subscribe({
        next: (data: any) => {
          if (data.exists && data.userId) {
            this.selectedUserAuthorizaId = data.userId;
            this.customersService.getUserRoles(data.userId).subscribe({
              next: (roles: any[]) => {
                const match = roles.find((r: any) => r.contractId === this.contractId && r.status === 'ACTIVE');
                if (match) {
                  this.selectedUserRole = match.roleId || '';
                  this.originalUserRole = this.selectedUserRole;
                }
              },
              error: () => {}
            });
          }
        },
        error: () => {}
      });
    }
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedUser = null;
  }

  saveUserChanges(): void {
    if (!this.selectedUserAuthorizaId || !this.contractId) {
      Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'No se pudo identificar al usuario en el sistema.', confirmButtonColor: '#0066CC' });
      return;
    }

    this.savingRole = true;
    const userId = this.selectedUserAuthorizaId;
    const tenantToken = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
    let tenantId: string | null = null;
    try {
      const payload = JSON.parse(atob(tenantToken!.split('.')[1]));
      tenantId = payload.tenantId || payload.basicDataId || null;
    } catch {}

    // If role changed
    if (this.selectedUserRole !== this.originalUserRole) {
      // Remove old role if it existed
      const removeOld = this.originalUserRole
        ? this.customersService.removeRole(userId, this.originalUserRole, this.contractId)
        : new Observable<any>(sub => { sub.next(null); sub.complete(); });

      removeOld.subscribe({
        next: () => {
          if (this.selectedUserRole) {
            // Ensure dependency exists, then assign new role
            const ensureDependency = tenantId
              ? this.customersService.createUserDependency(tenantId, userId)
              : new Observable<any>(sub => { sub.next(null); sub.complete(); });

            ensureDependency.subscribe({
              next: () => this.assignNewRole(userId),
              error: () => this.assignNewRole(userId), // dependency may already exist
            });
          } else {
            // Role removed, no new one
            this.savingRole = false;
            this.originalUserRole = '';
            this.loadRoles(); // refresh availability
            Swal.fire({ icon: 'success', title: 'Rol removido', timer: 1500, showConfirmButton: false });
          }
        },
        error: () => {
          // If remove fails, try assigning anyway
          if (this.selectedUserRole) {
            this.assignNewRole(userId);
          } else {
            this.savingRole = false;
          }
        }
      });
    } else {
      this.savingRole = false;
      Swal.fire({ icon: 'info', title: 'Sin cambios', text: 'No se detectaron cambios en el rol.', timer: 1500, showConfirmButton: false });
    }
  }

  private assignNewRole(userId: string): void {
    this.customersService.assignRole(userId, this.selectedUserRole, this.contractId!).subscribe({
      next: () => {
        this.savingRole = false;
        this.originalUserRole = this.selectedUserRole;
        this.loadRoles();
        Swal.fire({ icon: 'success', title: 'Rol asignado', text: 'Los cambios se guardaron correctamente.', confirmButtonColor: '#0066CC', timer: 2000, showConfirmButton: false });
      },
      error: (err: any) => {
        this.savingRole = false;
        Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo asignar el rol', confirmButtonColor: '#0066CC' });
      },
    });
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
