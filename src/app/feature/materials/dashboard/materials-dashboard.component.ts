import { Component, OnInit, Output, EventEmitter, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { MaterialService } from '../../../shared/services/material.service';
import { DocumentsService } from '../../../shared/services/documents.service';
import { MaterialMetrics } from '../../../shared/models/material.model';
import { MetricCardComponent } from '../../../shared/components/metric-card/metric-card.component';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { CategoryService } from '../../../shared/services/category/category.service';
import { PLANTILLA_MATERIALES_BASE64 } from './plantilla-materiales';

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
  uploadProgress = 0;
  uploadPhase: 'uploading' | 'processing' | '' = '';
  private progressInterval: any = null;
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

  constructor(private materialService: MaterialService, private router: Router, private categoryService: CategoryService, private documentsService: DocumentsService) {}

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

  generateInventoryReport(): void {
    this.materialService.getMaterials(undefined, 1, 1000).subscribe({
      next: (response) => {
        const items = (response.data || []).map((m: any) => ({
          code: m.strCode || '-',
          name: m.name || m.strName,
          category: m.categoryName || m.category?.name || '-',
          stock: Number(m.currentStock || m.ingQuantity || 0),
          unit: m.measurementUnit || m.strUnitMeasure || 'und',
          unitPrice: Number(m.price || m.fltPrice || 0),
          totalValue: Number(m.currentStock || m.ingQuantity || 0) * Number(m.price || m.fltPrice || 0)
        }));
        const totalValue = items.reduce((sum: number, item: any) => sum + item.totalValue, 0);
        this.documentsService.generateInventoryReport({
          date: new Date().toISOString().split('T')[0],
          items,
          totalValue,
          totalItems: items.length
        });
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los materiales para el reporte', 'error');
      }
    });
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
    const byteChars = atob(PLANTILLA_MATERIALES_BASE64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_materiales.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
    this.uploadProgress = 0;
    this.uploadPhase = 'uploading';

    this.materialService.bulkUpload(this.selectedFile).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          // Fase 1: Subiendo archivo (0% - 50%)
          const fileProgress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
          this.uploadProgress = Math.round(fileProgress * 0.5);
          this.uploadPhase = 'uploading';
        } else if (event.type === HttpEventType.Response) {
          // Fase 2 completada: Respuesta recibida (100%)
          this.stopProcessingSimulation();
          this.uploadProgress = 100;
          this.uploadPhase = '';
          this.uploadingFile = false;
          this.showUploadModal = false;

          const response = event.body;
          const hasErrors = response.errors.length > 0;
          Swal.fire({
            icon: hasErrors ? 'warning' : 'success',
            title: hasErrors ? 'Carga con advertencias' : '¡Carga Exitosa!',
            html: `
              <div style="text-align: center; padding: 8px 0;">
                <div style="display: inline-flex; gap: 24px; margin-bottom: 16px;">
                  <div style="text-align: center; padding: 12px 20px; background: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0;">
                    <div style="font-size: 28px; font-weight: 700; color: #16a34a;">${response.success}</div>
                    <div style="font-size: 11px; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px;">Creados</div>
                  </div>
                  <div style="text-align: center; padding: 12px 20px; background: ${hasErrors ? '#fef2f2' : '#f8f9fa'}; border-radius: 10px; border: 1px solid ${hasErrors ? '#fecaca' : '#e9ecef'};">
                    <div style="font-size: 28px; font-weight: 700; color: ${hasErrors ? '#dc2626' : '#6c757d'};">${response.errors.length}</div>
                    <div style="font-size: 11px; color: ${hasErrors ? '#991b1b' : '#6c757d'}; text-transform: uppercase; letter-spacing: 0.5px;">Errores</div>
                  </div>
                </div>
                ${hasErrors ? '<div style="text-align: left; max-height: 180px; overflow-y: auto; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 13px;">' + response.errors.map((e: any) => `<div style="margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #fee2e2;"><strong style="color: #991b1b;">${e.row}:</strong> <span style="color: #7f1d1d;">${e.error}</span></div>`).join('') + '</div>' : ''}
              </div>
            `,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#0d6efd',
            width: '420px',
            customClass: { popup: 'swal-rounded' }
          });
          
          this.loadMetrics();
          this.loadRecentActivities();
          this.refreshList.emit();
          this.selectedFile = null;
          this.validationResult = null;
        } else if (event.type === HttpEventType.Sent) {
          // Archivo enviado, ahora el servidor procesa
          this.uploadProgress = 50;
          this.uploadPhase = 'processing';
          this.startProcessingSimulation();
        }
      },
      error: (error) => {
        this.stopProcessingSimulation();
        this.uploadingFile = false;
        this.uploadProgress = 0;
        this.uploadPhase = '';
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar',
          text: error.error?.message || 'Error al cargar el archivo',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#0d6efd',
          customClass: { popup: 'swal-rounded' }
        });
      }
    });
  }

  private startProcessingSimulation(): void {
    // Simula avance gradual de 50% a 95% mientras el servidor procesa
    const totalRows = this.validationResult?.totalRows || 10;
    // Estimar ~200ms por registro para la velocidad de la simulación
    const estimatedMs = totalRows * 200;
    const steps = 45; // de 50 a 95
    const intervalMs = Math.max(estimatedMs / steps, 300);

    this.progressInterval = setInterval(() => {
      if (this.uploadProgress < 95) {
        this.uploadProgress += 1;
      } else {
        this.stopProcessingSimulation();
      }
    }, intervalMs);
  }

  private stopProcessingSimulation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
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
          title: '¡Categoría creada!',
          html: `
            <div style="display: flex; flex-direction: column; gap: 8px; padding: 8px 0;">
              <div style="display: flex; justify-content: center; gap: 16px;">
                <div style="padding: 8px 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                  <span style="font-size: 11px; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px;">ID</span>
                  <div style="font-size: 18px; font-weight: 700; color: #16a34a;">${category.id}</div>
                </div>
                <div style="padding: 8px 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                  <span style="font-size: 11px; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px;">Código</span>
                  <div style="font-size: 18px; font-weight: 700; color: #1d4ed8;">${category.code}</div>
                </div>
              </div>
            </div>
          `,
          timer: 3000,
          showConfirmButton: false,
          customClass: { popup: 'swal-rounded' }
        });
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo crear la categoría',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#0d6efd',
          customClass: { popup: 'swal-rounded' }
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
            title: '¡Carga Completada!',
            html: `
              <div style="text-align: center; padding: 8px 0;">
                <div style="display: inline-flex; gap: 24px; margin-bottom: 16px;">
                  <div style="text-align: center; padding: 12px 20px; background: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0;">
                    <div style="font-size: 28px; font-weight: 700; color: #16a34a;">${result.success}</div>
                    <div style="font-size: 11px; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px;">Éxitos</div>
                  </div>
                  <div style="text-align: center; padding: 12px 20px; background: ${result.errors.length > 0 ? '#fef2f2' : '#f8f9fa'}; border-radius: 10px; border: 1px solid ${result.errors.length > 0 ? '#fecaca' : '#e9ecef'};">
                    <div style="font-size: 28px; font-weight: 700; color: ${result.errors.length > 0 ? '#dc2626' : '#6c757d'};">${result.errors.length}</div>
                    <div style="font-size: 11px; color: ${result.errors.length > 0 ? '#991b1b' : '#6c757d'}; text-transform: uppercase; letter-spacing: 0.5px;">Errores</div>
                  </div>
                </div>
                ${result.errors.length > 0 ? '<div style="text-align: left; max-height: 180px; overflow-y: auto; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 13px;">' + result.errors.map((e: any) => `<div style="margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #fee2e2;"><strong style="color: #991b1b;">${e.row}:</strong> <span style="color: #7f1d1d;">${e.error}</span></div>`).join('') + '</div>' : ''}
              </div>
            `,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#0d6efd',
            width: '420px',
            customClass: { popup: 'swal-rounded' }
          });
          this.loadCategories();
          event.target.value = '';
        },
        error: (error) => {
          this.uploadingCategories = false;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.error?.message || 'No se pudo cargar el archivo',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#0d6efd',
            customClass: { popup: 'swal-rounded' }
          });
          event.target.value = '';
        }
      });
    }
  }
}