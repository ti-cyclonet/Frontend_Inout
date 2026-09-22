import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ProductService } from '../../../shared/services/product.service';
import { MaterialService } from '../../../shared/services/material.service';
import { CategoryService, Category } from '../../../shared/services/category/category.service';
import { WarehousesService } from '../../../shared/services/warehouses.service';
import { Material } from '../../../shared/models/material.model';
import { ImageManagerComponent } from '../../../shared/components/image-manager/image-manager.component';
import { environment } from '../../../../environments/environment';
import { convertUnits } from '../../../shared/utils/unit-conversion.util';
import Swal from 'sweetalert2';

interface ExtendedMaterial extends Material {
  isComposite?: boolean;
  categoryId?: number;
}

interface ProductComposition {
  id: number;
  productId: number;
  componentMaterialId: number;
  quantity: number;
  componentMaterial?: ExtendedMaterial;
}

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ImageManagerComponent],
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css']
})
export class ProductFormComponent implements OnInit {
  @Input() productId?: string;
  @Input() productData?: any;
  @Input() isModal = false;
  @Output() productCreated = new EventEmitter<void>();
  @Output() formCancelled = new EventEmitter<void>();

  productForm!: FormGroup;
  currentStep: number = 1;
  totalSteps: number = 4;
  loading = false;
  saving = false;
  isEditMode = false;
  productImages: any[] = [];
  imageFolder = '/InOut/products/'; // Carpeta específica para productos
  categories: Category[] = [];
  showCategoryForm = false;
  newCategory = {
    name: '',
    description: ''
  };

  // Materials
  availableMaterials: ExtendedMaterial[] = [];
  compositions: ProductComposition[] = [];
  selectedMaterials: Map<number, number> = new Map();
  
  // Filters
  nameFilter: string = '';
  locationFilter: string = '';
  categoryFilter: string = '';
  availableLocations: string[] = [];
  warehouseLocations: { value: string; label: string }[] = [];
  showFilters: boolean = false;
  showAvailableMaterials: boolean = false;
  showSelectedMaterials: boolean = false;
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 5;
  compositionsPage: number = 1;
  compositionsPerPage: number = 5;
  
  // Editing
  editingComposition: number | null = null;
  tempQuantity: number = 0;

  // Cálculo discriminado de precio sugerido (costo materiales + indirecto + margen)
  estimatedMonthlyUnits: number = 1;
  overheadTotal: number = 0;
  overheadBreakdown: { arriendo: number; agua: number; energia: number; gas: number; internet: number; nomina: number } | null = null;
  marginPercent: number = 0;
  loadingPricing = false;
  pricingError = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private productService: ProductService,
    private materialService: MaterialService,
    private categoryService: CategoryService,
    private warehousesService: WarehousesService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadCategories();
    this.loadAvailableMaterials();
    // Cargar ubicaciones ANTES de parchar el producto: si loadProductData()
    // setea strLocation antes de que existan las <option> del select, el
    // navegador no preselecciona nada (el <select> nativo ignora un value
    // sin match previo).
    this.loadWarehouseLocations(() => {
      if (this.productData) {
        this.isEditMode = true;
        this.showSelectedMaterials = true;
        this.loadProductData();
      }
    });
  }

  initForm(): void {
    this.productForm = this.fb.group({
      strName: ['', Validators.required],
      strDescription: ['', Validators.required],
      fltPrice: [0, [Validators.required, Validators.min(0)]],
      strMeasurementUnit: ['', Validators.required],
      ingStockMin: [0, [Validators.required, Validators.min(0)]],
      ingStockMax: [0, [Validators.required, Validators.min(1)]],
      strLocation: ['', Validators.required],
      categoryId: [null, Validators.required]
    });
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

  loadProductData(): void {
    this.productForm.patchValue({
      strName: this.productData.strName,
      strDescription: this.productData.strDescription,
      fltPrice: this.productData.fltPrice,
      strMeasurementUnit: this.productData.strMeasurementUnit,
      ingStockMin: this.productData.ingStockMin,
      ingStockMax: this.productData.ingStockMax,
      strLocation: this.productData.strLocation,
      categoryId: this.productData.intCategoryId
    });

    if (this.productData.images && this.productData.images.length > 0) {
      this.productImages = this.productData.images.map((img: any) => ({
        url: img.strImageUrl,
        strId: img.strId
      }));
    }
  }

  loadProductCompositions(): void {
    if (!this.productData?.strId) return;

    this.productService.getCompositionTwo(this.productData.strId).subscribe({
      next: (compositionTwo: any) => {
        compositionTwo.forEach((comp: any) => {
          const material = this.availableMaterials.find(m => m.id === comp.strMaterialId);
          if (material) {
            this.compositions.push({
              id: Date.now() + Math.random(),
              productId: 0,
              componentMaterialId: comp.strMaterialId,
              quantity: comp.fltQuantity,
              componentMaterial: material
            });
          }
        });
      }
    });

    this.productService.getCompositionThree(this.productData.strId).subscribe({
      next: (compositionThree: any) => {
        compositionThree.forEach((comp: any) => {
          const material = this.availableMaterials.find(m => m.id === comp.strTransformedMaterialId && m.isComposite);
          if (material) {
            this.compositions.push({
              id: Date.now() + Math.random(),
              productId: 0,
              componentMaterialId: comp.strTransformedMaterialId,
              quantity: comp.fltQuantity,
              componentMaterial: material
            });
          }
        });
      }
    });
  }

  loadAvailableMaterials(): void {
    // Load regular materials
    this.materialService.getMaterials().subscribe({
      next: (response) => {
        const regularMaterials = response.data.map((m: any) => ({
          ...m,
          isComposite: false
        }));
        
        // Load composite materials
        this.materialService.getTransformedMaterials().subscribe({
          next: (compositeResponse) => {
            const compositeMaterials = compositeResponse.map((m: any) => ({
              id: m.strId,
              name: m.strName,
              description: m.strDescription,
              price: m.fltPrice,
              measurementUnit: m.strUnitMeasure,
              dischargeUnit: m.strDischargeUnit,
              currentStock: m.ingQuantity,
              stockMin: m.ingMinStock,
              stockMax: m.ingMaxStock,
              ubicacion: m.strLocation,
              isComposite: true
            }));
            
            this.availableMaterials = [...regularMaterials, ...compositeMaterials];
            this.extractAvailableLocations();
            
            // Load compositions after materials are loaded
            if (this.isEditMode) {
              this.loadProductCompositions();
            }
          },
          error: (error) => {
            console.error('Error loading composite materials:', error);
            this.availableMaterials = regularMaterials;
            this.extractAvailableLocations();
            
            if (this.isEditMode) {
              this.loadProductCompositions();
            }
          }
        });
      },
      error: (error) => {
        console.error('Error loading materials:', error);
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

  loadWarehouseLocations(onLoaded?: () => void): void {
    this.warehousesService.getWarehouses().subscribe({
      next: (warehouses) => {
        // El producto guarda el locationCode corto (p. ej. "Z-15-10"), no el
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
        this.warehouseLocations = locations.length > 0 ? locations : [{ value: 'Bodega Principal', label: 'Bodega Principal' }];
        onLoaded?.();
      },
      error: () => {
        this.warehouseLocations = [{ value: 'Bodega Principal', label: 'Bodega Principal' }];
        onLoaded?.();
      }
    });
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      if (this.currentStep === 4) {
        this.loadPricingData();
      }
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 1:
        return !!(this.productForm.get('strName')?.valid && 
               this.productForm.get('strDescription')?.valid &&
               this.productForm.get('strMeasurementUnit')?.valid &&
               this.productForm.get('strLocation')?.valid);
      case 2:
        return this.productImages.length > 0;
      case 3:
        return this.compositions.length > 0;
      case 4:
        return true;
      default:
        return true;
    }
  }

  getFieldError(fieldName: string): string {
    const field = this.productForm.get(fieldName);
    if (field?.hasError('required')) return 'Este campo es requerido';
    if (field?.hasError('min')) return 'El valor debe ser mayor o igual a 0';
    return '';
  }

  onImagesChange(images: any[]): void {
    this.productImages = images;
  }

  getPaginatedMaterials(): ExtendedMaterial[] {
    const filtered = this.getFilteredMaterials();
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return filtered.slice(startIndex, startIndex + this.itemsPerPage);
  }

  getFilteredMaterials(): ExtendedMaterial[] {
    return this.availableMaterials.filter(material => {
      if (this.compositions.some(comp => comp.componentMaterialId === material.id)) {
        return false;
      }
      if (this.nameFilter && !material.name.toLowerCase().includes(this.nameFilter.toLowerCase())) {
        return false;
      }
      if (this.locationFilter && material.ubicacion !== this.locationFilter) {
        return false;
      }
      if (this.categoryFilter && material.categoryId?.toString() !== this.categoryFilter) {
        return false;
      }
      return true;
    });
  }

  getTotalPages(): number {
    return Math.ceil(this.getFilteredMaterials().length / this.itemsPerPage);
  }

  getTotalCompositionsPages(): number {
    return Math.ceil(this.compositions.length / this.compositionsPerPage);
  }

  getPaginatedCompositions(): ProductComposition[] {
    const startIndex = (this.compositionsPage - 1) * this.compositionsPerPage;
    return this.compositions.slice(startIndex, startIndex + this.compositionsPerPage);
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
    this.selectedMaterials.forEach((quantity, materialId) => {
      const material = this.availableMaterials.find(m => m.id === materialId);
      if (material && quantity > 0) {
        const newComposition: ProductComposition = {
          id: Date.now() + materialId,
          productId: 0,
          componentMaterialId: materialId,
          quantity: quantity,
          componentMaterial: material
        };
        this.compositions.push(newComposition);
      }
    });
    this.selectedMaterials.clear();
    this.currentPage = 1;
  }

  removeComposition(composition: ProductComposition): void {
    const index = this.compositions.findIndex(c => c.id === composition.id);
    if (index > -1) {
      this.compositions.splice(index, 1);
    }
  }

  startEditing(compositionId: number): void {
    this.editingComposition = compositionId;
    const comp = this.compositions.find(c => c.id === compositionId);
    if (comp) {
      this.tempQuantity = comp.quantity;
    }
  }

  saveEdit(composition: ProductComposition): void {
    if (this.tempQuantity > 0) {
      composition.quantity = this.tempQuantity;
    }
    this.editingComposition = null;
  }

  cancelEdit(): void {
    this.editingComposition = null;
  }

  clearFilters(): void {
    this.nameFilter = '';
    this.locationFilter = '';
    this.categoryFilter = '';
    this.currentPage = 1;
  }

  checkStockWarning(material: ExtendedMaterial): boolean {
    const quantity = this.selectedMaterials.get(material.id) || 0;
    // La cantidad se ingresa en la unidad de DESCARGA del material; el stock
    // vive en su unidad de MEDIDA. Se convierte antes de comparar.
    const dischargeUnit = material.dischargeUnit || material.measurementUnit;
    const quantityInStockUnit = convertUnits(quantity, dischargeUnit, material.measurementUnit);
    const remainingStock = (material.currentStock || 0) - quantityInStockUnit;
    return remainingStock < (material.stockMin || 0);
  }

  /** Costo de una línea de composición, convirtiendo la cantidad (unidad de
   * descarga) a la unidad de medida en la que está expresado el precio. */
  getCompositionCost(comp: ProductComposition): number {
    const price = comp.componentMaterial?.price || 0;
    const dischargeUnit = comp.componentMaterial?.dischargeUnit || comp.componentMaterial?.measurementUnit;
    const quantityInStockUnit = convertUnits(comp.quantity, dischargeUnit, comp.componentMaterial?.measurementUnit);
    return price * quantityInStockUnit;
  }

  getTotalCost(): number {
    return this.compositions.reduce((total, comp) => total + this.getCompositionCost(comp), 0);
  }

  /** Costo indirecto (arriendo, servicios, nómina) prorrateado por unidad. */
  get indirectCostPerUnit(): number {
    if (!this.overheadTotal || !this.estimatedMonthlyUnits || this.estimatedMonthlyUnits <= 0) return 0;
    return this.overheadTotal / this.estimatedMonthlyUnits;
  }

  /** Costo total por unidad: materiales + indirecto prorrateado. */
  get totalUnitCost(): number {
    return this.getTotalCost() + this.indirectCostPerUnit;
  }

  /** Precio sugerido = costo total + margen de ganancia configurado. Es el
   * precio mínimo permitido: nunca se debe vender por debajo de esto. */
  get suggestedPrice(): number {
    return this.totalUnitCost * (1 + (this.marginPercent || 0) / 100);
  }

  get priceBelowMinimum(): boolean {
    const price = +this.productForm?.get('fltPrice')?.value || 0;
    return this.suggestedPrice > 0 && price < this.suggestedPrice;
  }

  /** Carga el costo indirecto mensual y el % de ganancia configurados en el
   * periodo activo, para mostrar el desglose y calcular el precio sugerido. */
  loadPricingData(): void {
    this.loadingPricing = true;
    this.pricingError = false;

    Promise.all([
      this.http.get<any>(`${environment.apiUrl}/business-params/overhead`).toPromise(),
      this.http.get<any>(`${environment.apiUrl}/business-params`).toPromise(),
    ]).then(([overhead, params]) => {
      this.overheadTotal = overhead?.total || 0;
      this.overheadBreakdown = overhead?.breakdown || null;
      this.marginPercent = params?.PORCENTAJE_GANANCIA || 0;
      this.loadingPricing = false;
    }).catch(() => {
      this.loadingPricing = false;
      this.pricingError = true;
    });
  }

  onEstimatedUnitsChange(value: number): void {
    this.estimatedMonthlyUnits = value > 0 ? value : 1;
  }

  /** Aplica el precio sugerido tal cual al campo Precio. */
  useSuggestedPrice(): void {
    this.productForm.get('fltPrice')?.setValue(Math.round(this.suggestedPrice * 100) / 100);
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

  isFormValid(): boolean {
    return !!(this.productForm.valid && this.compositions.length > 0 && this.productImages.length > 0);
  }

  onSubmit(): void {
    if (!this.isFormValid()) return;

    if (this.priceBelowMinimum) {
      Swal.fire('Precio muy bajo', `El precio no puede ser menor al mínimo calculado (${this.formatCurrency(this.suggestedPrice)}), que cubre costo de materiales, costo indirecto y margen de ganancia.`, 'warning');
      return;
    }

    this.saving = true;
    const formData = this.productForm.value;

    const productData: any = {
      strName: formData.strName.toUpperCase(),
      strDescription: formData.strDescription,
      fltPrice: +formData.fltPrice,
      fltCost: this.totalUnitCost,
      strMeasurementUnit: formData.strMeasurementUnit,
      ingStockMin: +formData.ingStockMin,
      ingStockMax: +formData.ingStockMax,
      strLocation: formData.strLocation,
      compositionTwo: this.compositions
        .filter(comp => !comp.componentMaterial?.isComposite)
        .map(comp => ({
          componentMaterialId: String(comp.componentMaterialId),
          quantity: +comp.quantity
        })),
      compositionThree: this.compositions
        .filter(comp => comp.componentMaterial?.isComposite)
        .map(comp => ({
          componentTransformedMaterialId: String(comp.componentMaterialId),
          quantity: +comp.quantity
        })),
      images: this.productImages,
      categoryId: +formData.categoryId
    };

    const request = this.isEditMode && this.productData?.strId
      ? this.productService.updateProduct(this.productData.strId, productData)
      : this.productService.createProduct(productData);

    request.subscribe({
      next: () => {
        Swal.fire('Éxito', `Producto ${this.isEditMode ? 'actualizado' : 'creado'} correctamente`, 'success');
        this.productCreated.emit();
        this.saving = false;
      },
      error: (error) => {
        console.error('Error completo:', error);
        const errorMsg = typeof error.error?.message === 'string' 
          ? error.error.message 
          : (Array.isArray(error.error?.message) ? error.error.message.join(', ') : (error.message || 'No se pudo guardar el producto'));
        Swal.fire('Error', errorMsg, 'error');
        this.saving = false;
      }
    });
  }

  cancel(): void {
    this.formCancelled.emit();
  }

  createCategory(): void {
    if (!this.newCategory.name) return;
    
    const categoryData = {
      name: this.newCategory.name,
      description: this.newCategory.description
    };
    
    this.categoryService.create(categoryData).subscribe({
      next: (category) => {
        this.categories.push(category);
        this.productForm.patchValue({ categoryId: category.id });
        Swal.fire('Éxito', 'Categoría creada correctamente', 'success');
        this.cancelCategoryForm();
      },
      error: (error) => {
        Swal.fire('Error', 'No se pudo crear la categoría', 'error');
        console.error('Error creating category:', error);
      }
    });
  }

  cancelCategoryForm(): void {
    this.showCategoryForm = false;
    this.newCategory = {
      name: '',
      description: ''
    };
  }
}
