import { Component, OnInit, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NumberFormatPipe } from '../../../shared/pipes/number-format.pipe';
import { MaterialService } from '../../../shared/services/material.service';
import { CategoryService, Category } from '../../../shared/services/category/category.service';
import { WarehousesService } from '../../../shared/services/warehouses.service';
import { Material, MaterialComposition, MaterialImage } from '../../../shared/models/material.model';
import { ImageManagerComponent } from '../../../shared/components/image-manager/image-manager.component';
import { convertUnits } from '../../../shared/utils/unit-conversion.util';
import { ResalePricingComponent, ResaleConfig, resaleConfigFrom, resaleConfigPayload } from '../../../shared/components/resale-pricing/resale-pricing.component';

@Component({
  selector: 'app-material-composition',
  standalone: true,
  imports: [CommonModule, FormsModule, NumberFormatPipe, ImageManagerComponent, ResalePricingComponent],
  templateUrl: './material-composition.component.html',
  styleUrl: './material-composition.component.css'
})
export class MaterialCompositionComponent implements OnInit, OnChanges {
  @Input() externalModalControl = false;
  @Input() editMaterialId: string | null = null;
  @Input() initialStep: number = 1;
  transformedMaterials: any[] = [];
  availableMaterials: Material[] = [];
  compositions: MaterialComposition[] = [];
  loading = true;
  saving = false;
  showCreateModal = false;
  currentStep = 1;
  editingMaterialId: number | null = null;
  
  // New material form
  newMaterial = {
    name: '',
    description: '',
    measurementUnit: '',
    dischargeUnit: '',
    ubicacion: '',
    stockMin: 0,
    stockMax: 100,
    quantityToGenerate: 1,
    categoryId: null as number | null,
    marketplaceVisible: true
  };
  
  /** Reventa (presentación + precio). Vive en el paso 4; ver canProceedToNextStep(). */
  resaleConfig: ResaleConfig = resaleConfigFrom();
  /** Costo unitario guardado del material en edición (respaldo si no hay cantidades nuevas). */
  private storedUnitCost = 0;
  @ViewChild(ResalePricingComponent) resalePricing?: ResalePricingComponent;

  // Form state
  selectedMaterialId: number | null = null;
  quantity: number = 1;
  useDifferentDischargeUnit = false;
  
  // Filters
  nameFilter: string = '';
  locationFilter: string = '';
  categoryFilterMaterials: string = '';
  availableLocations: string[] = [];
  locationOptions: { value: string; label: string }[] = [];
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 5;
  
  // Selection
  selectedMaterials: Map<number, number> = new Map();
  selectedListItems: Set<string> = new Set();
  
  // Editing
  editingComposition: number | null = null;
  tempQuantity: number = 0;
  additionalQuantities: Map<number, number> = new Map();
  
  // UI State
  showFilters = false;
  showModalFilters = false;
  showAvailableMaterials = false;
  showSelectedMaterials = false;
  viewMode: 'table' | 'cards' = 'table';
  searchFilter = '';
  statusFilter = 'all';
  categoryFilter = '';
  categorySearch = '';
  showCategoryDropdown = false;
  selectedViewMaterial: any = null;
  
  private readonly VIEW_MODE_KEY = 'materials_composition_view_mode';
  
  // Image handling
  materialImages: MaterialImage[] = [];
  categories: Category[] = [];
  showCategoryForm = false;
  newCategory = {
    name: '',
    code: '',
    description: ''
  };

  constructor(
    private materialService: MaterialService,
    private categoryService: CategoryService,
    private warehousesService: WarehousesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadViewMode();
    this.loadCategories();
    this.loadAvailableMaterials();
    this.loadLocations();
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
        // El material guarda el locationCode corto (p. ej. "Z-15-10"), no el
        // nombre descriptivo de la ubicacion; el value del option debe ser
        // ese mismo codigo para que el select quede preseleccionado al editar.
        const locations: { value: string; label: string }[] = [];
        for (const wh of warehouses) {
          if (wh.locations && wh.locations.length > 0) {
            for (const loc of wh.locations) {
              locations.push({ value: loc.locationCode || loc.name, label: loc.name });
            }
          } else {
            locations.push({ value: wh.name, label: wh.name });
          }
        }
        this.locationOptions = locations;
      },
      error: () => {
        this.locationOptions = [];
      }
    });
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['externalModalControl'] && 
        changes['externalModalControl'].currentValue === true &&
        !changes['externalModalControl'].firstChange) {
      if (this.editMaterialId) {
        this.editMaterial(this.editMaterialId);
      } else {
        this.showCreateModal = true;
      }
    }
  }

  loadTransformedMaterials(): void {
    this.loading = true;
    this.materialService.getTransformedMaterials().subscribe({
      next: (response) => {
        this.transformedMaterials = response.map((item: any) => {
          const componentNames = (item.compositions || []).map((comp: any) => {
            const material = this.availableMaterials.find(m => m.id === comp.strComponentMaterialId);
            const name = material ? material.name : 'Desconocido';
            return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
          });
          return {
            id: item.strId,
            strCode: item.strCode,
            name: item.strName,
            description: item.strDescription,
            componentCount: item.compositions ? item.compositions.length : 0,
            componentNames: componentNames.join(' - '),
            totalCost: item.fltPrice * item.ingQuantity,
            currentStock: item.ingQuantity,
            stockMax: item.ingMaxStock,
            stockMin: item.ingMinStock,
            status: item.strStatus,
            measurementUnit: item.strUnitMeasure,
            price: item.fltPrice,
            location: item.strLocation,
            createDate: new Date(item.dtmCreationDate),
            images: item.images || []
          };
        });
        
        this.loading = false;
      },
      error: (error) => {
        this.transformedMaterials = [];
        this.loading = false;
      }
    });
  }

  addIngredient(): void {
    if (!this.selectedMaterialId || this.quantity <= 0) return;

    const componentMaterial = this.availableMaterials.find(m => m.id === this.selectedMaterialId);
    if (!componentMaterial) return;

    const newComposition: MaterialComposition = {
      id: Date.now(),
      materialId: 0,
      componentMaterialId: this.selectedMaterialId,
      quantity: this.quantity,
      componentMaterial
    };

    this.compositions.push(newComposition);
    this.resetIngredientForm();
  }

  removeIngredient(composition: MaterialComposition): void {
    const index = this.compositions.findIndex(c => c.id === composition.id);
    if (index > -1) {
      this.compositions.splice(index, 1);
    }
  }

  resetIngredientForm(): void {
    this.selectedMaterialId = null;
    this.quantity = 1;
  }

  nextStep(): void {
    if (this.currentStep < 5) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  canProceedToNextStep(): boolean {
    switch (this.currentStep) {
      case 1:
        return !!(this.newMaterial.name && this.newMaterial.description && 
                 this.newMaterial.measurementUnit && this.newMaterial.ubicacion);
      case 2:
        return true; // Images are optional
      case 3:
        return true; // Materials selection
      case 4:
        // Stock config + reventa (si está activa, debe estar completa y con
        // precio >= sugerido; el componente está montado en este paso)
        return !this.resalePricing?.validationError();
      default:
        return false;
    }
  }

  closeModal(): void {
    this.showCreateModal = false;
    this.currentStep = 1;
    this.editingMaterialId = null;
    this.resetAll();
    if (this.externalModalControl) {
      this.externalModalControl = false;
    }
  }

  createTransformedMaterial(): void {
    if (!this.isFormValid()) return;
    
    this.saving = true;
    
    const materialData: any = {
      strName: this.newMaterial.name,
      strDescription: this.newMaterial.description,
      strUnitMeasure: this.newMaterial.measurementUnit,
      fltPrice: this.getUnitPrice(),
      ingMinStock: Number(this.newMaterial.stockMin),
      ingMaxStock: Number(this.newMaterial.stockMax),
      strLocation: this.newMaterial.ubicacion,
      strStatus: 'Active',
      // Reventa: incluye blnMarketplaceVisible (solo aplica si es de reventa)
      ...resaleConfigPayload(this.resaleConfig),
    };

    // Solo incluir categoryId si tiene valor
    if (this.newMaterial.categoryId) {
      materialData.categoryId = Number(this.newMaterial.categoryId);
    }

    // Calcular ingQuantity correctamente
    if (this.editingMaterialId) {
      const additionalQty = this.getTotalQuantity();
      materialData.ingQuantity = Number(this.newMaterial.quantityToGenerate) + Number(additionalQty);
      // En ediciÃ³n, enviar composiciones con cantidades base + adicionales
      materialData.composition = this.compositions.map(comp => ({
        componentMaterialId: comp.componentMaterialId,
        quantity: Number(comp.quantity) + (this.additionalQuantities.get(comp.id) || 0)
      }));
    } else {
      materialData.ingQuantity = Number(this.getTotalQuantity());
      materialData.composition = this.compositions.map(comp => ({
        componentMaterialId: comp.componentMaterialId,
        quantity: Number(comp.quantity)
      }));
    }

    // Solo incluir estos campos en creación
    if (!this.editingMaterialId) {
      materialData.strDischargeUnit = this.useDifferentDischargeUnit && this.newMaterial.dischargeUnit ? this.newMaterial.dischargeUnit : this.newMaterial.measurementUnit;
      materialData.categoryId = this.newMaterial.categoryId;
    }

    // Preparar imágenes: solo enviar url (base64 para nuevas, URL para existentes)
    const imagesToSend = this.materialImages.map(img => ({
      url: img.url || img.strImageUrl
    }));
    materialData.images = imagesToSend;

    const request = this.editingMaterialId 
      ? this.materialService.updateTransformedMaterial(this.editingMaterialId, materialData)
      : this.materialService.createTransformedMaterial(materialData);

    request.subscribe({
      next: () => {
        if (this.editingMaterialId) {
          this.updateMaterialsStockForEdit();
        } else {
          this.updateMaterialsStock();
        }
        this.saving = false;
        this.closeModal();
        this.loadTransformedMaterials();
      },
      error: (error) => {
        console.error('Error completo:', error);
        console.error('Error response:', error.error);
        const errorMsg = Array.isArray(error.error?.message) 
          ? error.error.message.join(', ') 
          : error.error?.message || error.message || 'Error interno del servidor';
        alert('Error del servidor: ' + errorMsg);
        this.saving = false;
      }
    });
  }

  /** Convierte una cantidad de receta (unidad de DESCARGA del material) a su
   * unidad de MEDIDA (la del stock), para poder sumar/restar/costear correctamente. */
  private toStockUnit(material: Material | undefined, quantity: number): number {
    if (!material) return quantity;
    const dischargeUnit = material.dischargeUnit || material.measurementUnit;
    return convertUnits(quantity, dischargeUnit, material.measurementUnit);
  }

  private updateMaterialsStock(): void {
    this.compositions.forEach(comp => {
      const material = this.availableMaterials.find(m => m.id === comp.componentMaterialId);
      if (material) {
        const newStock = (material.currentStock || 0) - this.toStockUnit(material, comp.quantity);
        material.currentStock = Math.max(0, newStock);
      }
    });
  }

  private updateMaterialsStockForEdit(): void {
    this.compositions.forEach(comp => {
      const additional = this.additionalQuantities.get(comp.id) || 0;
      if (additional > 0) {
        const material = this.availableMaterials.find(m => m.id === comp.componentMaterialId);
        if (material) {
          const newStock = (material.currentStock || 0) - this.toStockUnit(material, additional);
          material.currentStock = Math.max(0, newStock);
        }
      }
    });
  }

  /** Cantidad efectiva de una línea (según si se está editando o no). */
  getCompositionQuantity(comp: MaterialComposition): number {
    return this.editingMaterialId ? (this.additionalQuantities.get(comp.id) || 0) : comp.quantity;
  }

  /** Costo de una línea, convirtiendo su cantidad (unidad de descarga) a la
   * unidad de medida en la que está expresado el precio del componente. */
  getCompositionCost(comp: MaterialComposition): number {
    const materialCost = comp.componentMaterial?.price || 0;
    return materialCost * this.toStockUnit(comp.componentMaterial, this.getCompositionQuantity(comp));
  }

  /** Unidad en la que se entiende la cantidad de una línea de receta:
   * la de descarga del componente (o su unidad de medida si no tiene). */
  getCompositionUnit(comp: MaterialComposition): string {
    return comp.componentMaterial?.dischargeUnit || comp.componentMaterial?.measurementUnit || '';
  }

  getTotalCost(): number {
    return this.compositions.reduce((total, comp) => total + this.getCompositionCost(comp), 0);
  }

  getTotalQuantity(): number {
    if (this.editingMaterialId) {
      let additionalTotal = 0;
      this.compositions.forEach(comp => {
        const additional = this.additionalQuantities.get(comp.id) || 0;
        additionalTotal += additional;
      });
      return additionalTotal > 0 ? additionalTotal : 0;
    }
    return this.compositions.reduce((total, comp) => total + comp.quantity, 0);
  }

  /** Stock que tendrá el material compuesto al guardar (para la sección de reventa). */
  getResultingStock(): number {
    return this.editingMaterialId
      ? Number(this.newMaterial.quantityToGenerate || 0) + this.getTotalQuantity()
      : this.getTotalQuantity();
  }

  /** Costo por unidad de medida para el precio de reventa. */
  getResaleUnitCost(): number {
    return this.getUnitPrice() || this.storedUnitCost;
  }

  getUnitPrice(): number {
    const totalCost = this.getTotalCost();
    const totalQuantity = this.getTotalQuantity();
    return totalQuantity > 0 ? totalCost / totalQuantity : 0;
  }

  loadAvailableMaterials(): void {
    this.materialService.getMaterials().subscribe({
      next: (response) => {
        this.availableMaterials = response.data;
        this.extractAvailableLocations();
        this.loadTransformedMaterials();
      },
      error: (error) => {
        console.error('Error loading materials:', error);
        this.loadTransformedMaterials();
      }
    });
  }

  extractAvailableLocations(): void {
    const locations = this.availableMaterials
      .map(m => m.ubicacion)
      .filter((location, index, arr) => location && arr.indexOf(location) === index)
      .sort();
    this.availableLocations = locations;
  }

  resetAll(): void {
    this.newMaterial = {
      name: '',
      description: '',
      measurementUnit: '',
      dischargeUnit: '',
      ubicacion: '',
      stockMin: 0,
      stockMax: 100,
      quantityToGenerate: 1,
      categoryId: null,
      marketplaceVisible: true
    };
    this.resaleConfig = resaleConfigFrom();
    this.storedUnitCost = 0;
    this.compositions = [];
    this.selectedMaterials.clear();
    this.additionalQuantities.clear();
    this.currentPage = 1;
    this.resetIngredientForm();
    this.materialImages = [];
    this.useDifferentDischargeUnit = false;
  }

  trackByCompositionId(index: number, composition: MaterialComposition): number {
    return composition.id;
  }

  getPaginatedMaterials(): Material[] {
    const filtered = this.getFilteredMaterials();
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return filtered.slice(startIndex, startIndex + this.itemsPerPage);
  }

  getTotalPages(): number {
    return Math.ceil(this.getFilteredMaterials().length / this.itemsPerPage);
  }

  nextPage(): void {
    if (this.currentPage < this.getTotalPages()) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  toggleMaterialSelection(materialId: number, quantity: number = 1): void {
    if (this.selectedMaterials.has(materialId)) {
      this.selectedMaterials.delete(materialId);
    } else {
      this.selectedMaterials.set(materialId, quantity);
    }
  }

  updateQuantity(materialId: number, quantity: number): void {
    if (this.selectedMaterials.has(materialId)) {
      this.selectedMaterials.set(materialId, quantity);
    }
  }

  addSelectedMaterials(): void {
    let hasErrors = false;
    const errorMaterials: string[] = [];
    
    this.selectedMaterials.forEach((quantity, materialId) => {
      const material = this.availableMaterials.find(m => m.id === materialId);
      if (material) {
        if ((material.currentStock || 0) <= 0) {
          hasErrors = true;
          errorMaterials.push(material.name);
        } else if (quantity > 0) {
          const newComposition = {
            id: Date.now() + materialId,
            materialId: 0,
            componentMaterialId: materialId,
            quantity: quantity,
            componentMaterial: material
          };
          this.compositions.push(newComposition);
        }
      }
    });
    
    if (hasErrors) {
      alert(`No se pueden agregar los siguientes materiales porque no tienen stock disponible:\n\n${errorMaterials.join('\n')}`);
      return;
    }
    
    this.selectedMaterials.clear();
    this.currentPage = 1;
  }

  getFilteredMaterials(): Material[] {
    const filtered = this.availableMaterials.filter(material => {
      // Exclude already selected materials
      if (this.compositions.some(comp => comp.componentMaterialId === material.id)) {
        return false;
      }
      
      // Apply name filter
      if (this.nameFilter && !material.name.toLowerCase().includes(this.nameFilter.toLowerCase())) {
        return false;
      }
      
      // Apply location filter
      if (this.locationFilter && material.ubicacion !== this.locationFilter) {
        return false;
      }
      
      // Apply category filter
      if (this.categoryFilterMaterials) {
        const materialCategoryId = (material as any).categoryId;
        const filterCategoryId = Number(this.categoryFilterMaterials);
        if (!materialCategoryId || materialCategoryId !== filterCategoryId) {
          return false;
        }
      }
      
      // Only show materials with stock greater than or equal to minimum stock
      const currentStock = Number(material.currentStock) || 0;
      const minStock = Number(material.stockMin) || 0;
      if (currentStock < minStock) {
        return false;
      }
      
      return true;
    });
    return filtered;
  }

  clearFilters(): void {
    this.nameFilter = '';
    this.locationFilter = '';
    this.categoryFilterMaterials = '';
    this.searchFilter = '';
    this.categoryFilter = '';
    this.currentPage = 1;
  }

  applyFilters(): void {
    this.currentPage = 1;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  formatCurrency(value: number): string {
    return '$' + new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  startEditing(compositionId: number): void {
    this.editingComposition = compositionId;
    const comp = this.compositions.find(c => c.id === compositionId);
    if (comp) {
      this.tempQuantity = comp.quantity;
    }
  }

  saveEdit(composition: MaterialComposition): void {
    if (this.tempQuantity > 0) {
      composition.quantity = this.tempQuantity;
    }
    this.editingComposition = null;
  }

  cancelEdit(): void {
    this.editingComposition = null;
  }

  onImagesChange(images: MaterialImage[]): void {
    this.materialImages = images;
  }

  checkStockWarning(material: Material): boolean {
    const quantity = this.selectedMaterials.get(material.id) || 0;
    const remainingStock = (material.currentStock || 0) - this.toStockUnit(material, quantity);
    return remainingStock < (material.stockMin || 0);
  }

  isFormValid(): boolean {
    return !!(this.newMaterial.name && 
             this.newMaterial.description && 
             this.newMaterial.measurementUnit && 
             this.newMaterial.ubicacion && 
             this.getTotalQuantity() > 0 &&
             this.compositions.length > 0);
  }

  getStockStatus(material: any): 'low' | 'normal' | 'high' {
    const currentStock = material.currentStock || material.ingQuantity || 0;
    const minStock = material.stockMin || material.ingMinStock || 0;
    
    if (currentStock < minStock) return 'low';
    return 'normal';
  }

  getStockStatusClass(material: any): string {
    const currentStock = parseFloat(material.currentStock || material.ingQuantity || 0);
    const minStock = parseFloat(material.stockMin || material.ingMinStock || 0);
    const status = currentStock < minStock ? 'low' : 'normal';
    return status === 'low' ? 'stock-low' : 'stock-normal';
  }

  createCategory(): void {
    if (!this.newCategory.name) return;
    
    const categoryData = {
      name: this.newCategory.name,
      description: this.newCategory.description || '',
      status: 'active'
    };
    
    this.categoryService.create(categoryData).subscribe({
      next: (category) => {
        this.categories.push(category);
        this.newMaterial.categoryId = category.id;
        this.cancelCategoryForm();
      },
      error: (error) => {
        console.error('Error creating category:', error);
        alert('No se pudo crear la categorÃ­a: ' + (error.error?.message || 'Error desconocido'));
      }
    });
  }

  cancelCategoryForm(): void {
    this.showCategoryForm = false;
    this.newCategory = {
      name: '',
      code: '',
      description: ''
    };
  }

  getFilteredCategories(): Category[] {
    if (!this.categorySearch) return this.categories;
    return this.categories.filter(c => 
      c.name.toLowerCase().includes(this.categorySearch.toLowerCase())
    );
  }

  getCategoryName(): string {
    if (!this.newMaterial.categoryId) return '';
    const category = this.categories.find(c => c.id === this.newMaterial.categoryId);
    return category ? category.name : '';
  }

  selectCategoryOption(categoryId: number | null): void {
    this.newMaterial.categoryId = categoryId;
    this.categorySearch = '';
    this.showCategoryDropdown = false;
  }

  onCategoryBlur(): void {
    setTimeout(() => {
      this.showCategoryDropdown = false;
      this.categorySearch = '';
    }, 200);
  }

  goToKardex(material: any): void {
    this.router.navigate(['/kardex'], {
      queryParams: {
        type: 'composite',
        code: material.strCode
      }
    });
  }

  // Slider methods for card view
  slideIndexMap: Map<number, number> = new Map();

  getSlideIndex(material: any): number {
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

  // List selection methods
  toggleListSelection(materialId: string): void {
    if (this.selectedListItems.has(materialId)) {
      this.selectedListItems.delete(materialId);
    } else {
      this.selectedListItems.add(materialId);
    }
  }

  selectAllList(): void {
    if (this.selectedListItems.size === this.transformedMaterials.length) {
      this.selectedListItems.clear();
    } else {
      this.transformedMaterials.forEach(m => this.selectedListItems.add(m.id));
    }
  }

  exportSelected(): void {
    console.log('Export selected:', Array.from(this.selectedListItems));
  }

  deleteSelected(): void {
    console.log('Delete selected:', Array.from(this.selectedListItems));
  }

  viewCompositeMaterial(material: any): void {
    this.selectedViewMaterial = material;
  }

  editMaterial(materialIdOrObject: any): void {
    const materialId = typeof materialIdOrObject === 'string' ? materialIdOrObject : materialIdOrObject.id;
    this.selectedViewMaterial = null;
    this.editingMaterialId = materialId;
    this.additionalQuantities.clear();
    this.materialService.getTransformedMaterialById(materialId).subscribe({
      next: (data) => {
        this.newMaterial = {
          name: data.strName,
          description: data.strDescription,
          measurementUnit: data.strUnitMeasure,
          dischargeUnit: data.strDischargeUnit,
          ubicacion: data.strLocation,
          stockMin: data.ingMinStock,
          stockMax: data.ingMaxStock,
          quantityToGenerate: data.ingQuantity,
          categoryId: data.categoryId,
          marketplaceVisible: data.blnMarketplaceVisible !== false
        };
        this.resaleConfig = resaleConfigFrom(data);
        this.storedUnitCost = Number(data.fltPrice) || 0;
        this.useDifferentDischargeUnit = data.strDischargeUnit !== data.strUnitMeasure;
        
        // Map images to the correct format
        this.materialImages = (data.images || []).map((img: any) => ({
          id: img.strId || Date.now(),
          materialId: 0,
          url: img.strImageUrl || img.url,
          strImageUrl: img.strImageUrl || img.url,
          status: 'active' as const
        }));
        
        // Map compositions with component material data
        this.compositions = (data.compositions || []).map((comp: any) => {
          const componentMaterial = this.availableMaterials.find(m => m.id === comp.strComponentMaterialId);
          const compId = comp.strId || Date.now() + Math.random();
          this.additionalQuantities.set(compId, 0);
          return {
            id: compId,
            materialId: materialId,
            componentMaterialId: comp.strComponentMaterialId,
            quantity: comp.fltQuantity,
            componentMaterial: componentMaterial || {
              id: comp.strComponentMaterialId,
              name: 'Cargando...',
              price: 0,
              measurementUnit: '',
              currentStock: 0,
              stockMin: 0
            }
          };
        });
        
        // Recargar materiales disponibles para actualizar stock
        this.loadAvailableMaterials();
        this.currentStep = this.initialStep;
        this.showSelectedMaterials = true;
        this.showCreateModal = true;
      },
      error: (error) => {
        console.error('Error loading material:', error);
        alert('No se pudo cargar el material');
      }
    });
  }
}
