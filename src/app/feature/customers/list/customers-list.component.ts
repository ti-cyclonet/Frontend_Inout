import { Component, OnInit, Output, EventEmitter, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CustomersService } from '../../../shared/services/customers.service';
import { Customer } from '../../../shared/model/customer.model';

interface CustomerFilters {
  search: string;
  status: 'all' | 'ACTIVE' | 'INACTIVE';
  documentType: string;
}

@Component({
  selector: 'app-customers-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers-list.component.html',
  styleUrls: ['./customers-list.component.css']
})
export class CustomersListComponent implements OnInit, OnChanges {
  @Input() refreshTrigger = 0;
  @Output() openCreateModal = new EventEmitter<void>();
  
  customers: Customer[] = [];
  loading = false;
  selectedCustomers: Set<string> = new Set();
  
  // Pagination
  currentPage = 1;
  pageSize = 6;
  totalItems = 0;
  totalPages = 0;
  pageSizeOptions = [6, 12, 18, 30];

  // Filters
  filters: CustomerFilters = {
    search: '',
    status: 'all',
    documentType: ''
  };

  // Sorting
  sortField = 'businessName';
  sortDirection: 'asc' | 'desc' = 'asc';

  // UI State
  showFilters = false;
  viewMode: 'table' | 'cards' = 'table';

  private readonly VIEW_MODE_KEY = 'customers_view_mode';

  constructor(
    private router: Router,
    private customersService: CustomersService
  ) {}

  ngOnInit(): void {
    this.loadViewMode();
    this.loadCustomers();
  }

  loadViewMode(): void {
    const savedMode = localStorage.getItem(this.VIEW_MODE_KEY);
    if (savedMode === 'table' || savedMode === 'cards') {
      this.viewMode = savedMode;
    }
  }

  setViewMode(mode: 'table' | 'cards'): void {
    this.viewMode = mode;
    localStorage.setItem(this.VIEW_MODE_KEY, mode);
  }

  ngOnChanges(): void {
    if (this.refreshTrigger > 0) {
      this.loadCustomers();
    }
  }

  loadCustomers(): void {
    this.loading = true;
    
    this.customersService.getCustomers().subscribe({
      next: (customers: Customer[]) => {
        let filteredCustomers = [...customers];
        
        // Apply filters
        if (this.filters.search) {
          filteredCustomers = filteredCustomers.filter(customer => {
            const displayName = this.getCustomerDisplayName(customer).toLowerCase();
            const searchTerm = this.filters.search.toLowerCase();
            
            return displayName.includes(searchTerm) ||
                   customer.contactPerson?.toLowerCase().includes(searchTerm) ||
                   customer.email?.toLowerCase().includes(searchTerm) ||
                   customer.documentNumber?.toLowerCase().includes(searchTerm);
          });
        }
        
        if (this.filters.status !== 'all') {
          filteredCustomers = filteredCustomers.filter(customer => customer.status === this.filters.status);
        }
        
        if (this.filters.documentType) {
          filteredCustomers = filteredCustomers.filter(customer => customer.documentType === this.filters.documentType);
        }
        
        this.totalItems = filteredCustomers.length;
        this.totalPages = Math.ceil(this.totalItems / this.pageSize);
        
        // Apply pagination
        const startIndex = (this.currentPage - 1) * this.pageSize;
        this.customers = filteredCustomers.slice(startIndex, startIndex + this.pageSize);
        
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading customers:', error);
        this.loading = false;
      }
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadCustomers();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadCustomers();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadCustomers();
  }

  onSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.loadCustomers();
  }

  toggleCustomerSelection(customerId: string): void {
    if (this.selectedCustomers.has(customerId)) {
      this.selectedCustomers.delete(customerId);
    } else {
      this.selectedCustomers.add(customerId);
    }
  }

  selectAllCustomers(): void {
    if (this.selectedCustomers.size === this.customers.length) {
      this.selectedCustomers.clear();
    } else {
      this.customers.forEach(customer => this.selectedCustomers.add(customer.id!));
    }
  }

  clearFilters(): void {
    this.filters = {
      search: '',
      status: 'all',
      documentType: ''
    };
    this.onFilterChange();
  }

  exportSelected(): void {
    console.log('Export selected customers:', Array.from(this.selectedCustomers));
  }

  deleteSelected(): void {
    console.log('Delete selected customers:', Array.from(this.selectedCustomers));
  }

  editCustomer(customer: Customer): void {
    console.log('Edit customer:', customer);
  }

  deleteCustomer(customer: Customer): void {
    if (customer.id) {
      this.customersService.removeCustomer(customer.id).subscribe({
        next: () => {
          this.loadCustomers();
        },
        error: (error: any) => {
          console.error('Error deleting customer:', error);
        }
      });
    }
  }

  viewCustomer(customer: Customer): void {
    console.log('View customer:', customer);
  }

  trackById(index: number, customer: Customer): string {
    return customer.id!;
  }

  get Math() {
    return Math;
  }

  getCustomerDisplayName(customer: Customer): string {
    // Si es persona jurídica, mostrar businessName
    if (customer.personType === 'J' && customer.businessName) {
      return customer.businessName;
    }
    
    // Si es persona natural o no está definido el tipo, intentar construir el nombre
    if (customer.personType === 'N' || !customer.personType) {
      const names = [
        customer.firstName,
        customer.secondName,
        customer.firstSurname,
        customer.secondSurname
      ].filter(name => name && name.trim()).join(' ');
      
      if (names) {
        return names;
      }
    }
    
    // Fallback: usar contactPerson, businessName o email
    return customer.contactPerson || customer.businessName || customer.email || 'Sin nombre';
  }

  getDocumentTypeLabel(customer: Customer): string {
    return customer.documentType || 'N/A';
  }

  getDocumentNumber(customer: Customer): string {
    if (!customer.documentNumber) return 'N/A';
    
    // Si es persona jurídica y tiene DV, mostrar número-dv
    if (customer.personType === 'J' && customer.documentDv) {
      return `${customer.documentNumber}-${customer.documentDv}`;
    }
    
    return customer.documentNumber;
  }
}