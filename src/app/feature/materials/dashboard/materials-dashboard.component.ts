import { Component, OnInit, Output, EventEmitter, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialService } from '../../../shared/services/material.service';
import { MaterialMetrics } from '../../../shared/models/material.model';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { CategoryService } from '../../../shared/services/category/category.service';

@Component({
  selector: 'app-materials-dashboard',
  standalone: true,
  imports: [CommonModule, MetricCardComponent, FormsModule],
  templateUrl: './materials-dashboard.component.html',
  styleUrls: ['./materials-dashboard.component.css']
})
export class MaterialsDashboardComponent implements OnInit, OnChanges {
  @Input() refreshTrigger = 0;
  @Output() openCreateModal = new EventEmitter<void>();
  @Output() openCompositionModal = new EventEmitter<void>();
  @Output() refreshList = new EventEmitter<void>();
  
  metrics: MaterialMetrics | null = null;
  recentActivities: any[] = [];
  loading = true;
  transformedMaterialsCount = 0;
  uploadingFile = false;
  showUploadModal = false;
  showCategoryModal = false;
  validationResult: any = null;
  selectedFile: File | null = null;
  categories: any[] = [];
  filteredCategories: any[] = [];
  categorySearch = '';
  categoryPage = 1;
  categoryPageSize = 5;
  showAddCategory = false;
  newCategoryName = '';
  newCategoryDescription = '';
  categoriesExpanded = true;
  uploadingCategories = false;

  constructor(private materialService: MaterialService, private router: Router, private categoryService: CategoryService) {}

  ngOnInit(): void {
    this.loadMetrics();
    this.loadRecentActivities();
    this.loadTransformedMaterialsCount();
  }

  ngOnChanges(): void {
    if (this.refreshTrigger > 0) {
      this.loadMetrics();
      this.loadRecentActivities();
      this.loadTransformedMaterialsCount();
    }
  }

  loadMetrics(): void {
    this.loading = true;
    this.materialService.getMetrics().subscribe({
      next: (metrics) => {
        this.metrics = metrics;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
      }
    });
  }

  loadRecentActivities(): void {
    this.materialService.getRecentActivities().subscribe({
      next: (activities) => {
        this.recentActivities = activities;
      },
      error: (error) => {
        this.recentActivities = [];
      }
    });
  }

  loadTransformedMaterialsCount(): void {
    this.materialService.getTransformedMaterials().subscribe({
      next: (materials) => {
        this.transformedMaterialsCount = materials.length;
      },
      error: () => {
        this.transformedMaterialsCount = 0;
      }
    });
  }

  navigateToComposition(): void {
    this.openCompositionModal.emit();
  }

  navigateToCreate(): void {
    this.openCreateModal.emit();
  }

  openUploadModal(): void {
    this.showUploadModal = true;
    this.validationResult = null;
    this.selectedFile = null;
    this.uploadingFile = false;
    this.loadCategories();
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
    this.validationResult = null;
    this.selectedFile = null;
  }

  downloadTemplate(): void {
    const link = document.createElement('a');
    link.href = '/assets/plantilla_materiales.xlsx';
    link.download = 'plantilla_materiales.xlsx';
    link.click();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    
    this.selectedFile = file;
    this.uploadingFile = true;
    this.validationResult = null;
    
    this.materialService.bulkValidate(file).subscribe({
      next: (response) => {
        this.uploadingFile = false;
        this.validationResult = response;
        if (response) {
          this.categoriesExpanded = false;
        }
        event.target.value = '';
      },
      error: (error) => {
        this.uploadingFile = false;
        this.validationResult = {
          valid: false,
          message: 'Error al validar el archivo',
          errors: [],
          totalRows: 0,
          validRows: 0
        };
        this.categoriesExpanded = false;
        event.target.value = '';
      }
    });
  }

  closeValidationModal(): void {
    this.showUploadModal = false;
    this.validationResult = null;
    this.selectedFile = null;
  }

  confirmUpload(): void {
    if (!this.selectedFile) return;
    
    this.uploadingFile = true;
    this.materialService.bulkUpload(this.selectedFile).subscribe({
      next: (response) => {
        this.uploadingFile = false;
        this.showUploadModal = false;
        
        Swal.fire({
          icon: 'success',
          title: 'Carga Completada',
          html: `
            <strong>${response.message}</strong><br><br>
            Éxitos: ${response.success}<br>
            Errores: ${response.errors.length}
            ${response.errors.length > 0 ? '<br><br><div style="text-align: left; max-height: 200px; overflow-y: auto; padding: 10px; background: #f8f9fa; border-radius: 5px;">' + response.errors.map((e: any) => `<strong>${e.row}:</strong> ${e.error}`).join('<br>') + '</div>' : ''}
          `,
          confirmButtonText: 'Aceptar',
          width: '600px'
        });
        
        this.loadMetrics();
        this.loadRecentActivities();
        this.refreshList.emit();
        this.selectedFile = null;
        this.validationResult = null;
      },
      error: (error) => {
        this.uploadingFile = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error?.message || 'Error al cargar el archivo'
        });
      }
    });
  }

  loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (categories: any[]) => {
        this.categories = categories;
        this.filterCategories();
      },
      error: () => {
        this.categories = [];
        this.filteredCategories = [];
      }
    });
  }

  filterCategories(): void {
    const search = this.categorySearch.toLowerCase();
    const filtered = this.categories.filter(cat => 
      cat.name.toLowerCase().includes(search) || 
      cat.id.toString().includes(search)
    );
    this.filteredCategories = filtered;
    this.categoryPage = 1;
  }

  get paginatedCategories(): any[] {
    const start = (this.categoryPage - 1) * this.categoryPageSize;
    return this.filteredCategories.slice(start, start + this.categoryPageSize);
  }

  get totalCategoryPages(): number {
    return Math.ceil(this.filteredCategories.length / this.categoryPageSize);
  }

  nextCategoryPage(): void {
    if (this.categoryPage < this.totalCategoryPages) {
      this.categoryPage++;
    }
  }

  prevCategoryPage(): void {
    if (this.categoryPage > 1) {
      this.categoryPage--;
    }
  }

  toggleAddCategory(): void {
    this.showAddCategory = !this.showAddCategory;
    this.newCategoryName = '';
    this.newCategoryDescription = '';
  }

  addCategory(): void {
    if (!this.newCategoryName.trim()) return;
    
    this.categoryService.create({ 
      name: this.newCategoryName, 
      description: this.newCategoryDescription || this.newCategoryName,
      status: 'active' 
    }).subscribe({
      next: (category) => {
        this.categories.push(category);
        this.filterCategories();
        this.showAddCategory = false;
        this.newCategoryName = '';
        this.newCategoryDescription = '';
        Swal.fire({
          icon: 'success',
          title: 'Categoría creada',
          html: `<strong>ID:</strong> ${category.id}<br><strong>Código:</strong> ${category.code}`,
          timer: 3000,
          showConfirmButton: false
        });
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo crear la categoría'
        });
      }
    });
  }

  toggleCategoriesAccordion(): void {
    this.categoriesExpanded = !this.categoriesExpanded;
  }

  openCategoryModal(): void {
    this.showCategoryModal = true;
    this.loadCategories();
  }

  closeCategoryModal(): void {
    this.showCategoryModal = false;
    this.categorySearch = '';
    this.showAddCategory = false;
    this.newCategoryName = '';
    this.newCategoryDescription = '';
  }

  downloadCategoryTemplate(): void {
    this.categoryService.downloadTemplate();
  }

  onCategoryFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.uploadingCategories = true;
      this.categoryService.bulkUpload(file).subscribe({
        next: (result) => {
          this.uploadingCategories = false;
          Swal.fire({
            icon: 'success',
            title: 'Carga Completada',
            html: `
              <strong>${result.message}</strong><br><br>
              Éxitos: ${result.success}<br>
              Errores: ${result.errors.length}
              ${result.errors.length > 0 ? '<br><br><div style="text-align: left; max-height: 200px; overflow-y: auto; padding: 10px; background: #f8f9fa; border-radius: 5px;">' + result.errors.map((e: any) => `<strong>${e.row}:</strong> ${e.error}`).join('<br>') + '</div>' : ''}
            `,
            confirmButtonText: 'Aceptar'
          });
          this.loadCategories();
          event.target.value = '';
        },
        error: (error) => {
          this.uploadingCategories = false;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.error?.message || 'No se pudo cargar el archivo'
          });
          event.target.value = '';
        }
      });
    }
  }
}