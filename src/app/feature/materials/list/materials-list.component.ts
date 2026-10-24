import { Component, OnInit, Output, EventEmitter, Input, OnChanges, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NumberFormatPipe } from '../../../shared/pipes/number-format.pipe';
import { convertUnits } from '../../../shared/utils/unit-conversion.util';
import { MaterialService } from '../../../shared/services/material.service';
import { CategoryService, Category } from '../../../shared/services/category/category.service';
import { WarehousesService } from '../../../shared/services/warehouses.service';
import { Material, MaterialFilters, PaginatedResponse } from '../../../shared/models/material.model';

@Component({
  selector: 'app-materials-list',
  standalone: true,
  imports: [CommonModule, FormsModule, NumberFormatPipe],
  templateUrl: './materials-list.component.html',
  styleUrls: ['./materials-list.component.css']
})
export class MaterialsListComponent implements OnInit, OnChanges {
  @Input() refreshTrigger = 0;
  @Output() openCreateModal = new EventEmitter<void>();
  @Output() openEditModal = new EventEmitter<Material>();
  materials: Material[] = [];
  categories: Category[] = [];
  loading = false;
  selectedMaterials: Set<number> = new Set();
  categorySearch = '';
  showCategoryDropdown = false;
  
  // Pagination
  currentPage = 1;
  pageSize = 6;
  totalItems = 0;
  totalPages = 0;
  pageSizeOptions = [6, 12, 18, 30];

  // Filters
  filters: MaterialFilters = {
    search: '',
    ubicacion: [],
    priceRange: [0, 1000],
    stockStatus: 'all',
    status: 'all',
    categoryId: '',
    location: '',
    expiring: 0
  };

  /** Lote más próximo a vencer de cada material (próximos 15 días), por id. */
  expiringById = new Map<string, { daysLeft: number; expiresAt: string; lots: number; expired?: boolean }>();
  readonly EXPIRING_DAYS = 15;
  private http = inject(HttpClient);

  // Sorting
  sortField = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  // UI State
  showFilters = false;
  viewMode: 'table' | 'cards' = 'table';
  locationOptions: string[] = [];

  private readonly VIEW_MODE_KEY = 'materials_view_mode';

  constructor(
    private materialService: MaterialService,
    private categoryService: CategoryService,
    private warehousesService: WarehousesService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Desde "Requiere atención" (?stock=low): la lista llega filtrada
    const stock = this.route.snapshot.queryParamMap.get('stock');
    if (stock === 'out' || stock === 'low' || stock === 'high' || stock === 'normal') {
      this.filters.stockStatus = stock;
      this.showFilters = true;
    }
    // ?expiring=15: solo los materiales con lotes por vencer
    const expiring = Number(this.route.snapshot.queryParamMap.get('expiring')) || 0;
    if (expiring > 0) {
      this.filters.expiring = expiring;
      this.showFilters = true;
    }
    this.loadExpiring();
    this.loadViewMode();
    this.loadCategories();
    this.loadLocations();
    this.loadMaterials();
  }

  /** Lotes por vencer: resaltan la fila y muestran en cuántos días vence. */
  loadExpiring(): void {
    this.http.get<{ materials: { materialId: string; daysLeft: number; expiresAt: string; lots: number; expired?: boolean }[] }>(
      `${environment.apiUrl}/dashboard/materials/expiring`, { params: { days: String(this.EXPIRING_DAYS) } },
    ).subscribe({
      next: (r) => { this.expiringById = new Map((r?.materials || []).map((m) => [m.materialId, m])); },
      error: () => { this.expiringById = new Map(); },
    });
  }

  expiringOf(material: any): { daysLeft: number; expiresAt: string; lots: number; expired?: boolean } | null {
    return this.expiringById.get(material?.id || material?.strId) || null;
  }

  /** Tiene un lote vencido (últimos 30 días, con stock): se resalta en rojo. */
  isExpired(material: any): boolean {
    return !!this.expiringOf(material)?.expired;
  }

  expiringLabel(material: any): string {
    const e = this.expiringOf(material);
    if (!e) return '';
    const ago = -e.daysLeft;
    const when = e.expired ? (ago === 1 ? 'vencido ayer' : `vencido hace ${ago} días`)
      : e.daysLeft === 0 ? 'vence hoy' : e.daysLeft === 1 ? 'vence mañana' : `vence en ${e.daysLeft} días`;
    return e.lots > 1 ? `Lote ${when} (+${e.lots - 1})` : `Lote ${when}`;
  }

  loadViewMode(): void {
    const savedMode = localStorage.getItem(this.VIEW_MODE_KEY);
    if (savedMode === 'table' || savedMode === 'cards') {
      this.viewMode = savedMode;
    }
  }

  loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  loadLocations(): void {
    this.warehousesService.getWarehouses().subscribe({
      next: (warehouses) => {
        const locations: string[] = [];
        for (const wh of warehouses) {
          if (wh.locations && wh.locations.length > 0) {
            for (const loc of wh.locations) {
              locations.push(loc.name);
            }
          } else {
            locations.push(wh.name);
          }
        }
        this.locationOptions = locations;
      },
      error: () => { this.locationOptions = []; }
    });
  }

  setViewMode(mode: 'table' | 'cards'): void {
    this.viewMode = mode;
    localStorage.setItem(this.VIEW_MODE_KEY, mode);
  }

  ngOnChanges(): void {
    if (this.refreshTrigger > 0) {
      this.loadMaterials();
    }
  }

  loadMaterials(): void {
    this.loading = true;
    
    // Load only regular materials (not transformed materials)
    this.materialService.getMaterials(this.filters, this.currentPage, this.pageSize)
      .subscribe({
        next: (response: PaginatedResponse<Material>) => {
          this.materials = response.data;
          this.totalItems = response.total;
          this.totalPages = response.totalPages;
          console.log('Pagination:', { total: this.totalItems, pages: this.totalPages, current: this.currentPage, size: this.pageSize });
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

  getStockStatus(material: any): 'low' | 'normal' | 'high' {
    const currentStock = material.ingQuantity || material.currentStock || 0;
    const minStock = material.ingMinStock || material.stockMin || 0;
    
    // Agotado o bajo el mínimo: se resalta igual (en rojo)
    if (currentStock <= 0 || currentStock < minStock) return 'low';
    return 'normal';
  }

  /** Tiene unidad de descarga distinta a la de medida (compra en kg, stock en g). */
  hasDischargeUnit(material: any): boolean {
    const measure = material?.measurementUnit || material?.strUnitMeasure;
    const discharge = material?.dischargeUnit || material?.strDischargeUnit;
    return !!discharge && discharge !== measure;
  }

  /** Unidad en que se muestra el stock: la de descarga si existe, si no la de medida. */
  stockUnit(material: any): string {
    return this.hasDischargeUnit(material)
      ? (material.dischargeUnit || material.strDischargeUnit)
      : (material?.measurementUnit || material?.strUnitMeasure || '');
  }

  /** El stock se guarda en unidad de medida; se muestra convertido a la de descarga. */
  inStockUnit(material: any, value: any): number {
    const qty = parseFloat(value || 0) || 0;
    if (!this.hasDischargeUnit(material)) return qty;
    return convertUnits(qty, material.measurementUnit || material.strUnitMeasure, this.stockUnit(material), material.packSize ?? material.intPackSize);
  }

  getStockStatusClass(material: any): string {
    const currentStock = parseFloat(material.ingQuantity || material.currentStock || 0);
    const minStock = parseFloat(material.ingMinStock || material.stockMin || 0);
    const status = currentStock <= 0 || currentStock < minStock ? 'low' : 'normal';
    return status === 'low' ? 'stock-low' : 'stock-normal';
  }

  clearFilters(): void {
    this.filters = {
      search: '',
      ubicacion: [],
      priceRange: [0, 1000],
      stockStatus: 'all',
      status: 'all',
      categoryId: '',
      location: '',
      expiring: 0
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
    this.selectedViewMaterial = null;
    this.openEditModal.emit(material);
  }

  deleteMaterial(material: Material): void {
    console.log('Delete material:', material);
  }

  selectedViewMaterial: Material | null = null;

  viewMaterial(material: Material): void {
    this.selectedViewMaterial = material;
  }

  closeViewModal(): void {
    this.selectedViewMaterial = null;
  }

  trackById(index: number, material: Material): number {
    return material.id;
  }

  // Slider methods for card view
  slideIndexMap: Map<number, number> = new Map();

  getSlideIndex(material: Material): number {
    return this.slideIndexMap.get(material.id) || 0;
  }

  prevSlide(material: any): void {
    const current = this.getSlideIndex(material);
    this.slideIndexMap.set(material.id, current > 0 ? current - 1 : material.images.length - 1);
  }

  nextSlide(material: any): void {
    const current = this.getSlideIndex(material);
    this.slideIndexMap.set(material.id, current < material.images.length - 1 ? current + 1 : 0);
  }

  setSlide(material: any, index: number): void {
    this.slideIndexMap.set(material.id, index);
  }

  get Math() {
    return Math;
  }

  getFilteredCategories(): Category[] {
    if (!this.categorySearch) return this.categories;
    return this.categories.filter(c => 
      c.name.toLowerCase().includes(this.categorySearch.toLowerCase())
    );
  }

  getSelectedCategoryName(): string {
    if (!this.filters.categoryId) return '';
    const category = this.categories.find(c => c.id.toString() === this.filters.categoryId);
    return category ? category.name : '';
  }

  selectCategory(categoryId: string): void {
    this.filters.categoryId = categoryId;
    this.categorySearch = '';
    this.showCategoryDropdown = false;
    this.onFilterChange();
  }

  onCategoryBlur(): void {
    setTimeout(() => {
      this.showCategoryDropdown = false;
      this.categorySearch = '';
    }, 200);
  }

  getExpirationStatus(expirationDate: string | null | undefined): 'expired' | 'warning' | 'ok' | 'none' {
    if (!expirationDate) return 'none';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expirationDate);
    expDate.setHours(0, 0, 0, 0);

    if (expDate < today) return 'expired';

    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 15) return 'warning';
    return 'ok';
  }

  getExpirationLabel(status: string): string {
    switch (status) {
      case 'expired': return 'Vencido';
      case 'warning': return 'Próximo';
      case 'ok': return 'Vigente';
      default: return '';
    }
  }

  goToKardex(material: Material): void {
    this.router.navigate(['/kardex'], {
      queryParams: {
        type: 'material',
        code: material['strCode']?.replace('JMY-M-', '')
      }
    });
  }
}