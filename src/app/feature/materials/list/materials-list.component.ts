import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NumberFormatPipe } from '../../../shared/pipes/number-format.pipe';
import { MaterialService } from '../../../shared/services/material.service';
import { Material, MaterialFilters, PaginatedResponse } from '../../../shared/models/material.model';

@Component({
  selector: 'app-materials-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NumberFormatPipe],
  templateUrl: './materials-list.component.html',
  styleUrls: ['./materials-list.component.css']
})
export class MaterialsListComponent implements OnInit {
  materials: Material[] = [];
  loading = false;
  selectedMaterials: Set<number> = new Set();
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;
  pageSizeOptions = [10, 25, 50, 100];

  // Filters
  filters: MaterialFilters = {
    search: '',
    ubicacion: [],
    priceRange: [0, 1000],
    stockStatus: 'all',
    status: 'all'
  };

  // Sorting
  sortField = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  // UI State
  showFilters = false;
  viewMode: 'table' | 'cards' = 'table';

  constructor(private materialService: MaterialService) {}

  ngOnInit(): void {
    this.loadMaterials();
  }

  loadMaterials(): void {
    this.loading = true;
    this.materialService.getMaterials(this.filters, this.currentPage, this.pageSize)
      .subscribe({
        next: (response: PaginatedResponse<Material>) => {
          this.materials = response.data;
          this.totalItems = response.total;
          this.totalPages = response.totalPages;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading materials:', error);
          this.loading = false;
        }
      });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadMaterials();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadMaterials();
  }

  onPageSizeChange(): void {
    this.currentPage = 1;
    this.loadMaterials();
  }

  onSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.loadMaterials();
  }

  toggleMaterialSelection(materialId: number): void {
    if (this.selectedMaterials.has(materialId)) {
      this.selectedMaterials.delete(materialId);
    } else {
      this.selectedMaterials.add(materialId);
    }
  }

  selectAllMaterials(): void {
    if (this.selectedMaterials.size === this.materials.length) {
      this.selectedMaterials.clear();
    } else {
      this.materials.forEach(material => this.selectedMaterials.add(material.id));
    }
  }

  getStockStatus(material: Material): 'low' | 'normal' | 'high' {
    const stockPercentage = (material.currentStock || 0) / material.stockMax;
    if (stockPercentage < 0.3) return 'low';
    if (stockPercentage > 0.8) return 'high';
    return 'normal';
  }

  getStockStatusClass(material: Material): string {
    const status = this.getStockStatus(material);
    return `stock-${status}`;
  }

  clearFilters(): void {
    this.filters = {
      search: '',
      ubicacion: [],
      priceRange: [0, 1000],
      stockStatus: 'all',
      status: 'all'
    };
    this.onFilterChange();
  }

  exportSelected(): void {
    console.log('Export selected materials:', Array.from(this.selectedMaterials));
  }

  deleteSelected(): void {
    console.log('Delete selected materials:', Array.from(this.selectedMaterials));
  }

  editMaterial(material: Material): void {
    console.log('Edit material:', material);
  }

  deleteMaterial(material: Material): void {
    console.log('Delete material:', material);
  }

  viewMaterial(material: Material): void {
    console.log('View material:', material);
  }

  trackById(index: number, material: Material): number {
    return material.id;
  }

  get Math() {
    return Math;
  }
}