import { Component, Input, OnInit, OnChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { CustomersService } from '../../../shared/services/customers.service';
import { decodeJwtPayload } from '../../../shared/utils/jwt.util';
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

  users: any[] = [];
  filteredUsers: any[] = [];
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
  selectedUser: any | null = null;
  selectedUserRole = '';
  originalUserRole = '';
  selectedUserSigner = false;
  originalUserSigner = false;
  savingRole = false;
  availableRoles: any[] = [];
  contractId: string | null = null;
  tenantId: string | null = null;
  private selectedDependencyId: string | null = null;
  private selectedUserAuthorizaId: string | null = null;

  Math = Math;

  constructor(private customersService: CustomersService) {}

  ngOnInit(): void {
    this.resolveTenantAndContract(() => {
      this.loadUsers();
      this.loadRoles();
    });
  }

  ngOnChanges(): void {
    if (this.refreshTrigger > 0) {
      this.loadUsers();
    }
  }

  private resolveTenantAndContract(onResolved: () => void): void {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
    if (!token) return;

    const payload = decodeJwtPayload(token);
    this.tenantId = payload?.tenantId || payload?.basicDataId || null;
    if (!this.tenantId) return;

    this.customersService.getTenantContract(this.tenantId).subscribe({
      next: (data: any) => {
        this.contractId = data.contractId;
        onResolved();
      },
      error: () => onResolved(),
    });
  }

  loadRoles(): void {
    if (!this.contractId) return;
    this.customersService.getRoleAvailability(this.contractId).subscribe({
      next: (roles: any[]) => {
        // Show all roles with available slots
        this.availableRoles = roles;
      },
      error: () => {}
    });
  }

  openUserDetail(user: any): void {
    this.selectedUser = user;
    this.selectedUserAuthorizaId = user.userId || null;
    this.selectedDependencyId = user.dependencyId || null;
    this.selectedUserSigner = !!user.isAuthorizedSigner;
    this.originalUserSigner = this.selectedUserSigner;

    const currentRole = (user.roles || [])[0];
    this.selectedUserRole = currentRole?.id || '';
    this.originalUserRole = this.selectedUserRole;

    this.showDetailModal = true;
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

    const roleChanged = this.selectedUserRole !== this.originalUserRole;
    const signerChanged = this.selectedUserSigner !== this.originalUserSigner;

    if (!roleChanged && !signerChanged) {
      Swal.fire({ icon: 'info', title: 'Sin cambios', text: 'No se detectaron cambios.', timer: 1500, showConfirmButton: false });
      return;
    }

    this.savingRole = true;
    const userId = this.selectedUserAuthorizaId;

    const applySignerChange = () => {
      if (signerChanged && this.selectedDependencyId) {
        this.customersService.updateSigner(this.selectedDependencyId, this.selectedUserSigner).subscribe({
          next: () => this.finishSave(),
          error: () => this.finishSave(),
        });
      } else {
        this.finishSave();
      }
    };

    if (!roleChanged) {
      applySignerChange();
      return;
    }

    // Remove old role if it existed
    const removeOld = this.originalUserRole
      ? this.customersService.removeRole(userId, this.originalUserRole, this.contractId)
      : new Observable<any>(sub => { sub.next(null); sub.complete(); });

    removeOld.subscribe({
      next: () => {
        if (this.selectedUserRole) {
          // Ensure dependency exists, then assign new role
          const ensureDependency = this.tenantId
            ? this.customersService.createUserDependency(this.tenantId, userId)
            : new Observable<any>(sub => { sub.next(null); sub.complete(); });

          ensureDependency.subscribe({
            next: () => this.assignNewRole(userId, applySignerChange),
            error: () => this.assignNewRole(userId, applySignerChange), // dependency may already exist
          });
        } else {
          applySignerChange();
        }
      },
      error: () => {
        // If remove fails, try assigning anyway
        if (this.selectedUserRole) {
          this.assignNewRole(userId, applySignerChange);
        } else {
          this.savingRole = false;
        }
      }
    });
  }

  private assignNewRole(userId: string, then: () => void): void {
    this.customersService.assignRole(userId, this.selectedUserRole, this.contractId!).subscribe({
      next: () => {
        this.originalUserRole = this.selectedUserRole;
        then();
      },
      error: (err: any) => {
        this.savingRole = false;
        Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo asignar el rol', confirmButtonColor: '#0066CC' });
      },
    });
  }

  private finishSave(): void {
    this.savingRole = false;
    this.originalUserSigner = this.selectedUserSigner;
    this.loadRoles();
    this.loadUsers();
    Swal.fire({ icon: 'success', title: 'Cambios guardados', text: 'Los cambios se guardaron correctamente.', confirmButtonColor: '#0066CC', timer: 2000, showConfirmButton: false });
  }

  loadUsers(): void {
    if (!this.tenantId) return;
    this.loading = true;

    this.customersService.getDependentsWithRoles(this.tenantId, this.contractId || undefined).subscribe({
      next: (dependents: any[]) => {
        this.users = dependents.map(d => ({
          id: d.userId,
          userId: d.userId,
          dependencyId: d.dependencyId,
          email: d.email,
          customerCode: d.code,
          personType: d.personType,
          firstName: d.firstName,
          firstSurname: d.firstSurname,
          businessName: d.businessName,
          documentType: d.documentType,
          documentNumber: d.documentNumber,
          phone: d.phone,
          isActive: d.isActive,
          isAuthorizedSigner: d.isAuthorizedSigner,
          createdAt: d.createdAt,
          roles: d.roles,
        }));
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

  getUserName(user: any): string {
    if (user.personType === 'J') {
      return user.businessName || 'Sin nombre';
    }
    return [user.firstName, user.firstSurname].filter(Boolean).join(' ') || 'Sin nombre';
  }

  removeUser(user: any): void {
    if (!user?.dependencyId) return;
    if (!confirm('¿Estás seguro de que deseas quitar a este usuario del equipo? Perderá su acceso a la aplicación y su cupo de rol quedará libre.')) {
      return;
    }

    // Liberar el cupo del rol antes de desactivar la dependencia.
    const roleRemovals = (user.roles || []).map((r: any) =>
      this.customersService.removeRole(user.userId, r.id, this.contractId!)
    );

    const finish = () => {
      this.customersService.deactivateDependency(user.dependencyId).subscribe({
        next: () => { this.loadUsers(); this.loadRoles(); },
        error: (error: unknown) => console.error('Error removing user:', error),
      });
    };

    if (roleRemovals.length === 0 || !this.contractId) {
      finish();
      return;
    }

    let pending = roleRemovals.length;
    roleRemovals.forEach((obs: Observable<any>) => {
      obs.subscribe({ next: () => { if (--pending === 0) finish(); }, error: () => { if (--pending === 0) finish(); } });
    });
  }
}
