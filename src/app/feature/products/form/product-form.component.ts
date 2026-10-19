import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ProductService } from '../../../shared/services/product.service';
import { MaterialService } from '../../../shared/services/material.service';
import { CategoryService, Category } from '../../../shared/services/category/category.service';
import { WarehousesService } from '../../../shared/services/warehouses.service';
import { StockAlertsService } from '../../../shared/services/stock-alerts.service';
import { Material } from '../../../shared/models/material.model';
import { ImageManagerComponent } from '../../../shared/components/image-manager/image-manager.component';
import { environment } from '../../../../environments/environment';
import { convertUnits } from '../../../shared/utils/unit-conversion.util';
import { decodeJwtPayload } from '../../../shared/utils/jwt.util';
import { actualMargin, effectiveMargin, inheritedMarginLabel, marginPayload, priceWithMargin } from '../../../shared/utils/pricing-margin';
import Swal from 'sweetalert2';
import { InfoTipComponent } from '../../../shared/components/info-tip/info-tip.component';
import { ProductPresentation } from '../../../shared/services/product.service';

interface ExtendedMaterial extends Material {
  isComposite?: boolean;
  categoryId?: number;
  /** Material de la receta que no está en la lista cargada (ver missingMaterial). */
  missing?: boolean;
}

/** Producto "para armar": lista de la carta de la que el cliente escoge (ej. 2 proteínas). */
interface ChoiceGroup {
  block: string;
  min: number;
  max: number;
}

const MAX_CHOICE_GROUPS = 4;

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
  imports: [InfoTipComponent, CommonModule, ReactiveFormsModule, FormsModule, ImageManagerComponent],
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css']
})
export class ProductFormComponent implements OnInit {
  @Input() productId?: string;
  @Input() productData?: any;
  @Input() isModal = false;
  @Output() productCreated = new EventEmitter<void>();
  @Output() formCancelled = new EventEmitter<void>();
  /** Abrir otra presentación de la familia (la lista cierra este formulario y abre esa). */
  @Output() openPresentation = new EventEmitter<string>();

  /** Presentación de este producto (ej. "8 oz") y las de su familia. */
  variantLabel = '';
  presentations: ProductPresentation[] = [];
  addingPresentation = false;

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
  /** Falló la carga de materiales: la receta podría estar incompleta, no se guarda. */
  materialsLoadFailed = false;
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

  // Cálculo discriminado de precio sugerido (costo materiales + mano de obra directa + indirecto + margen)
  /** Unidades planeadas al mes para ESTE producto, en el período activo.
   * Ya no se edita aquí: se configura en Settings > Plan de Producción
   * (asociado al período/subperíodo activo) y se consulta de solo lectura. */
  plannedMonthlyUnits: number = 0;
  loadingProductionPlan = false;
  /** Mostrar/ocultar el texto explicativo de cada campo (toggle de ojito). */
  /** true cuando el producto es nuevo (aún sin guardar): no existe un plan
   * de producción posible todavía porque no hay productId. */
  productionPlanUnavailable = false;
  /** Mano de obra DIRECTA por unidad (opcional): costo trazable a este
   * producto puntual, distinto de la nómina indirecta que ya está en el
   * overhead prorrateado. Default 0 para no forzar su uso. */
  directLaborCost: number = 0;
  overheadTotal: number = 0;
  overheadBreakdown: { arriendo: number; agua: number; energia: number; gas: number; internet: number; nomina: number; planInout?: number } | null = null;
  /** El negocio decidió incluir su plan de InOut en el costeo (Configuración). */
  overheadIncludesInoutPlan = false;
  /** Margen del período (PORCENTAJE_GANANCIA) y mínimo permitido (MARGEN_MINIMO). */
  marginPercent: number = 0;
  minMarginPercent = 0;
  /** Margen del producto: heredado (categoría o período) o propio. */
  marginMode: 'inherit' | 'custom' = 'inherit';
  customMargin: number | null = null;
  /** Listas de la carta (MarketPlace → Información de la carta) y las que usa este producto. */
  menuBlocks: { title: string; count: number }[] = [];
  menuBlocksLoaded = false;
  choiceGroups: ChoiceGroup[] = [];
  readonly maxChoiceGroups = MAX_CHOICE_GROUPS;
  loadingPricing = false;
  pricingError = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private productService: ProductService,
    private materialService: MaterialService,
    private categoryService: CategoryService,
    private warehousesService: WarehousesService,
    private stockAlertsService: StockAlertsService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadCategories();
    this.loadAvailableMaterials();
    this.loadMenuBlocks();
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
      categoryId: [null, Validators.required],
      marketplaceVisible: [true],
      // Fabricación bajo pedido: se puede pedir sin stock
      madeToOrder: [false],
      productionLeadHours: [null as number | null, [Validators.min(0)]]
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
      categoryId: this.productData.intCategoryId,
      marketplaceVisible: this.productData.blnMarketplaceVisible !== false,
      madeToOrder: !!this.productData.blnMadeToOrder,
      productionLeadHours: this.productData.intProductionLeadHours ?? null
    });
    this.directLaborCost = +(this.productData.fltDirectLaborCost || 0);
    this.variantLabel = this.productData.strVariantLabel || '';
    this.loadPresentations();
    const ownMargin = this.productData.fltMarginPercent;
    this.marginMode = ownMargin !== null && ownMargin !== undefined && ownMargin !== '' ? 'custom' : 'inherit';
    this.customMargin = this.marginMode === 'custom' ? Number(ownMargin) : null;
    this.choiceGroups = (Array.isArray(this.productData.jsonChoiceGroups) ? this.productData.jsonChoiceGroups : [])
      .map((g: any) => ({ block: String(g.block || ''), min: Number(g.min) || 0, max: Number(g.max) || 1 }));

    if (this.productData.images && this.productData.images.length > 0) {
      this.productImages = this.productData.images.map((img: any) => ({
        url: img.strImageUrl,
        strId: img.strId
      }));
    }
  }

  /**
   * La receta guardada usa un material que no está en la lista cargada (falló la
   * carga, o el material ya no existe): la línea se conserva con este marcador en
   * vez de descartarse. Antes se descartaba en silencio y, como al guardar el
   * backend reemplaza la receta completa, el producto perdía ingredientes.
   */
  private missingMaterial(id: string, isComposite: boolean): any {
    return { id, name: 'Material no disponible', price: 0, measurementUnit: '', dischargeUnit: '', isComposite, missing: true };
  }

  /** No se puede guardar con la receta incompleta: se perderían ingredientes o costo. */
  get recipeIncomplete(): boolean {
    return this.materialsLoadFailed || this.compositions.some((c) => c.componentMaterial?.missing);
  }

  loadProductCompositions(): void {
    if (!this.productData?.strId) return;

    this.productService.getCompositionTwo(this.productData.strId).subscribe({
      next: (compositionTwo: any) => {
        compositionTwo.forEach((comp: any) => {
          const material = this.availableMaterials.find(m => m.id === comp.strMaterialId && !m.isComposite)
            || this.missingMaterial(comp.strMaterialId, false);
          this.compositions.push({
            id: Date.now() + Math.random(),
            productId: 0,
            componentMaterialId: comp.strMaterialId,
            quantity: comp.fltQuantity,
            componentMaterial: material
          });
        });
      }
    });

    this.productService.getCompositionThree(this.productData.strId).subscribe({
      next: (compositionThree: any) => {
        compositionThree.forEach((comp: any) => {
          const material = this.availableMaterials.find(m => m.id === comp.strTransformedMaterialId && m.isComposite)
            || this.missingMaterial(comp.strTransformedMaterialId, true);
          this.compositions.push({
            id: Date.now() + Math.random(),
            productId: 0,
            componentMaterialId: comp.strTransformedMaterialId,
            quantity: comp.fltQuantity,
            componentMaterial: material
          });
        });
      }
    });
  }

  loadAvailableMaterials(): void {
    this.materialsLoadFailed = false;
    // Todos los materiales del tenant: getMaterials() solo traía los primeros 10
    this.materialService.getAllMaterials().subscribe({
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
              packSize: m.intPackSize ?? null,
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
            this.materialsLoadFailed = true;
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
        this.materialsLoadFailed = true;
        // La receta se muestra igual (con marcadores) para no perderla de vista
        if (this.isEditMode) this.loadProductCompositions();
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
        this.loadProductionPlanUnits();
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
    const quantityInStockUnit = convertUnits(quantity, dischargeUnit, material.measurementUnit, material.packSize);
    const remainingStock = (material.currentStock || 0) - quantityInStockUnit;
    return remainingStock < (material.stockMin || 0);
  }

  /** Costo de una línea de composición, convirtiendo la cantidad (unidad de
   * descarga) a la unidad de medida en la que está expresado el precio. */
  getCompositionCost(comp: ProductComposition): number {
    const price = comp.componentMaterial?.price || 0;
    const dischargeUnit = comp.componentMaterial?.dischargeUnit || comp.componentMaterial?.measurementUnit;
    const quantityInStockUnit = convertUnits(comp.quantity, dischargeUnit, comp.componentMaterial?.measurementUnit, comp.componentMaterial?.packSize);
    return price * quantityInStockUnit;
  }

  getTotalCost(): number {
    return this.compositions.reduce((total, comp) => total + this.getCompositionCost(comp), 0);
  }

  /** Costo indirecto (arriendo, servicios, nómina) prorrateado por unidad,
   * usando las unidades planeadas configuradas en Settings > Plan de
   * Producción para este producto en el período activo. */
  get indirectCostPerUnit(): number {
    if (!this.overheadTotal || !this.plannedMonthlyUnits || this.plannedMonthlyUnits <= 0) return 0;
    return this.overheadTotal / this.plannedMonthlyUnits;
  }

  /** Costo total por unidad: materiales + mano de obra directa (si aplica) + indirecto prorrateado. */
  get totalUnitCost(): number {
    return this.getTotalCost() + (this.directLaborCost || 0) + this.indirectCostPerUnit;
  }

  /** Categoría elegida en el formulario (para su margen). */
  private get selectedCategory(): any {
    const id = this.productForm?.get('categoryId')?.value;
    return this.categories.find((c: any) => String(c.id) === String(id)) || null;
  }

  /** Margen que aplica: el propio, el de la categoría o el del período. */
  get effective() {
    return effectiveMargin({
      item: this.marginMode === 'custom' ? this.customMargin : null,
      category: (this.selectedCategory as any)?.fltMarginPercent,
      period: this.marginPercent,
    });
  }

  get inheritedLabel(): string {
    const c: any = this.selectedCategory;
    return inheritedMarginLabel(c?.name || null, c?.fltMarginPercent, this.marginPercent);
  }

  /** Precio sugerido = costo total + margen que aplica (objetivo). */
  get suggestedPrice(): number {
    return priceWithMargin(this.totalUnitCost, this.effective.percent);
  }

  /** Piso: costo total + margen mínimo del período (0 = no vender bajo costo). */
  get minimumPrice(): number {
    return priceWithMargin(this.totalUnitCost, this.minMarginPercent);
  }

  private get priceValue(): number {
    return +this.productForm?.get('fltPrice')?.value || 0;
  }

  get priceBelowMinimum(): boolean {
    return this.minimumPrice > 0 && this.priceValue + 0.005 < this.minimumPrice;
  }

  /** Entre el piso y el sugerido: se permite con aviso. */
  get priceBelowTarget(): boolean {
    return this.suggestedPrice > 0 && this.priceValue + 0.5 < this.suggestedPrice;
  }

  get realMargin(): number | null {
    return actualMargin(this.priceValue, this.totalUnitCost);
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
      this.overheadIncludesInoutPlan = !!overhead?.includesInoutPlan;
      this.marginPercent = params?.PORCENTAJE_GANANCIA || 0;
      this.minMarginPercent = Math.max(0, Number(params?.MARGEN_MINIMO) || 0);
      this.loadingPricing = false;
    }).catch(() => {
      this.loadingPricing = false;
      this.pricingError = true;
    });
  }

  /** Trae las unidades planeadas (Settings > Plan de Producción) para este
   * producto en el período activo. Solo tiene sentido en modo edición: un
   * producto nuevo aún no tiene id con el que buscar su plan. */
  loadProductionPlanUnits(): void {
    if (!this.isEditMode || !this.productData?.strId) {
      this.productionPlanUnavailable = true;
      this.plannedMonthlyUnits = 0;
      return;
    }

    this.loadingProductionPlan = true;
    this.productionPlanUnavailable = false;

    this.http.get<any>(`${environment.apiUrl}/periods/active/current`).subscribe({
      next: (activePeriod) => {
        if (!activePeriod?.id) {
          this.loadingProductionPlan = false;
          this.productionPlanUnavailable = true;
          return;
        }
        this.http.get<any>(`${environment.apiUrl}/production-plans/product/${this.productData.strId}`, {
          params: { periodId: activePeriod.id }
        }).subscribe({
          next: (plan) => {
            this.plannedMonthlyUnits = plan?.plannedMonthlyUnits || 0;
            this.loadingProductionPlan = false;
          },
          error: () => {
            this.loadingProductionPlan = false;
            this.productionPlanUnavailable = true;
          }
        });
      },
      error: () => {
        this.loadingProductionPlan = false;
        this.productionPlanUnavailable = true;
      }
    });
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

  /** Listas de la carta del negocio (endpoint público del MarketPlace). */
  private loadMenuBlocks(): void {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const tenantId = token ? decodeJwtPayload(token)?.tenantId : null;
    if (!tenantId) { this.menuBlocksLoaded = true; return; }
    this.http.get<any>(`${environment.apiUrl}/marketplace-config/${tenantId}/menu-extras`).subscribe({
      next: (extras) => {
        this.menuBlocks = (extras?.blocks || [])
          .filter((b: any) => b?.title && Array.isArray(b.items) && b.items.length)
          .map((b: any) => ({ title: b.title, count: b.items.length }));
        this.menuBlocksLoaded = true;
      },
      error: () => (this.menuBlocksLoaded = true),
    });
  }

  /** Lista guardada que ya no está en la carta (se borró o renombró). */
  blockMissing(block: string): boolean {
    return this.menuBlocksLoaded && !!block && !this.menuBlocks.some((b) => b.title === block);
  }

  addChoiceGroup(): void {
    if (this.choiceGroups.length >= MAX_CHOICE_GROUPS) return;
    const used = new Set(this.choiceGroups.map((g) => g.block));
    const free = this.menuBlocks.find((b) => !used.has(b.title));
    this.choiceGroups.push({ block: free?.title || '', min: 1, max: 1 });
  }

  removeChoiceGroup(index: number): void {
    this.choiceGroups.splice(index, 1);
  }

  /** Mensaje si los grupos no tienen sentido (el backend valida lo mismo). */
  private choiceGroupsError(): string | null {
    const seen = new Set<string>();
    for (const g of this.choiceGroups) {
      if (!g.block) return 'Escoge la lista de cada grupo de opciones (o quítalo).';
      if (seen.has(g.block)) return `La lista "${g.block}" está repetida en las opciones.`;
      seen.add(g.block);
      const min = Number(g.min), max = Number(g.max);
      if (!Number.isInteger(max) || max < 1 || max > 10) return `En "${g.block}" el máximo debe estar entre 1 y 10.`;
      if (!Number.isInteger(min) || min < 0 || min > max) return `En "${g.block}" el mínimo debe estar entre 0 y ${max}.`;
    }
    return null;
  }

  /** "Escoge 2", "Hasta 3", "De 1 a 2". */
  choiceRule(g: ChoiceGroup): string {
    const min = Number(g.min) || 0, max = Number(g.max) || 0;
    return min === max ? `Escoge ${max}` : min === 0 ? `Hasta ${max} (opcional)` : `De ${min} a ${max}`;
  }

  isFormValid(): boolean {
    return !!(this.productForm.valid && this.compositions.length > 0 && this.productImages.length > 0);
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid()) return;

    if (this.recipeIncomplete) {
      Swal.fire(
        'Receta incompleta',
        this.materialsLoadFailed
          ? 'No se pudieron cargar todos los materiales. Recarga la página antes de guardar para no perder ingredientes de la receta.'
          : 'La receta tiene materiales que ya no están disponibles (marcados en rojo). Quítalos o reemplázalos antes de guardar.',
        'warning',
      );
      return;
    }

    if (this.marginMode === 'custom' && !(Number(this.customMargin) >= 0 && Number(this.customMargin) <= 1000)) {
      Swal.fire('Margen del producto', 'Escribe un margen entre 0 % y 1000 %, o usa el de la categoría o el del período.', 'warning');
      return;
    }
    if (this.priceBelowMinimum) {
      Swal.fire('Precio muy bajo', `El precio no puede ser menor al mínimo (${this.formatCurrency(this.minimumPrice)}): ${this.minMarginPercent > 0 ? `costo total más el ${this.minMarginPercent} % mínimo del período` : 'quedarías vendiendo bajo costo'}.`, 'warning');
      return;
    }
    if (this.priceBelowTarget) {
      const ok = await Swal.fire({
        icon: 'question',
        title: 'Por debajo del margen objetivo',
        text: `Con ${this.formatCurrency(this.priceValue)} el margen real es ${this.realMargin} % y el objetivo es ${this.effective.percent} % (precio sugerido ${this.formatCurrency(this.suggestedPrice)}). ¿Guardar con este precio?`,
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Revisar',
      });
      if (!ok.isConfirmed) return;
    }

    const choiceError = this.choiceGroupsError();
    if (choiceError) {
      Swal.fire('Opciones del producto', choiceError, 'warning');
      return;
    }

    this.saving = true;
    const formData = this.productForm.value;

    const productData: any = {
      strName: formData.strName.toUpperCase(),
      strDescription: formData.strDescription,
      fltPrice: +formData.fltPrice,
      fltCost: this.totalUnitCost,
      fltDirectLaborCost: +this.directLaborCost || 0,
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
      categoryId: +formData.categoryId,
      blnMarketplaceVisible: formData.marketplaceVisible !== false,
      blnMadeToOrder: !!formData.madeToOrder,
      jsonChoiceGroups: this.choiceGroups.map((g) => ({ block: g.block, min: Number(g.min), max: Number(g.max) })),
      fltMarginPercent: marginPayload(this.marginMode, this.customMargin),
      // Presentación de venta: solo al editar (las nuevas se crean desde aquí)
      ...(this.isEditMode && (this.variantLabel.trim() || this.productData?.strVariantLabel)
        ? { strVariantLabel: this.variantLabel.trim() || null }
        : {}),
      ...(formData.productionLeadHours !== null && formData.productionLeadHours !== ''
        ? { intProductionLeadHours: Math.max(0, Math.round(+formData.productionLeadHours)) }
        : {})
    };

    const request = this.isEditMode && this.productData?.strId
      ? this.productService.updateProduct(this.productData.strId, productData)
      : this.productService.createProduct(productData);

    request.subscribe({
      next: () => {
        Swal.fire('Éxito', `Producto ${this.isEditMode ? 'actualizado' : 'creado'} correctamente`, 'success');
        this.productCreated.emit();
        // Crear/editar un producto puede cambiar su stock o sus mínimos/máximos:
        // refrescar el badge de alertas sin esperar a recargar la página.
        this.stockAlertsService.refreshAlerts();
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

  loadPresentations(): void {
    if (!this.productData?.strId) return;
    this.productService.getPresentations(this.productData.strId).subscribe({
      next: (list) => (this.presentations = list || []),
      error: () => (this.presentations = []),
    });
  }

  /**
   * Nueva presentación (12 oz, 20 oz…): copia este producto con su receta y
   * fotos, con stock en cero. Después se ajustan su receta y su precio.
   */
  async addPresentation(): Promise<void> {
    if (!this.productData?.strId || this.addingPresentation) return;
    const needsOwn = !this.variantLabel.trim();
    const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const { value } = await Swal.fire({
      title: 'Nueva presentación',
      html: `
        <div style="text-align:left;font-size:0.9rem">
          ${needsOwn ? `<label style="display:block;font-weight:600;margin-bottom:4px">Presentación de ${esc(this.productData.strName)}</label>
          <input id="pres-own" class="swal2-input" style="margin:0 0 12px;width:100%" maxlength="40" placeholder="Ej: 8 oz">` : ''}
          <label style="display:block;font-weight:600;margin-bottom:4px">Nueva presentación</label>
          <input id="pres-label" class="swal2-input" style="margin:0 0 12px;width:100%" maxlength="40" placeholder="Ej: 12 oz">
          <label style="display:block;font-weight:600;margin-bottom:4px">Precio de venta</label>
          <input id="pres-price" type="number" min="0" class="swal2-input" style="margin:0 0 8px;width:100%" value="${Number(this.productForm.value.fltPrice) || 0}">
          <small style="color:#6b7280">Se copia la receta, las fotos y la configuración de este producto. Luego ajusta su receta y su precio.</small>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Crear presentación',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      preConfirm: () => {
        const own = (document.getElementById('pres-own') as HTMLInputElement | null)?.value.trim() || '';
        const label = (document.getElementById('pres-label') as HTMLInputElement).value.trim();
        const price = Number((document.getElementById('pres-price') as HTMLInputElement).value);
        if (needsOwn && !own) return Swal.showValidationMessage(`Escribe la presentación de ${this.productData.strName} (ej. 8 oz).`);
        if (!label) return Swal.showValidationMessage('Escribe la nueva presentación (ej. 12 oz).');
        if (!(price >= 0)) return Swal.showValidationMessage('Revisa el precio.');
        return { own, label, price };
      },
    });
    if (!value) return;
    this.addingPresentation = true;
    this.productService.createPresentation(this.productData.strId, {
      label: value.label,
      ...(needsOwn ? { sourceLabel: value.own } : {}),
      price: value.price,
    }).subscribe({
      next: (created: any) => {
        this.addingPresentation = false;
        if (needsOwn) this.variantLabel = value.own;
        this.loadPresentations();
        Swal.fire({
          icon: 'success',
          title: `Presentación ${value.label} creada`,
          text: 'Revisa su receta y su precio: se copiaron de este producto.',
          showCancelButton: true,
          confirmButtonText: 'Editarla ahora',
          cancelButtonText: 'Seguir aquí',
        }).then((r) => {
          if (r.isConfirmed && created?.strId) this.openPresentation.emit(created.strId);
        });
      },
      error: (err) => {
        this.addingPresentation = false;
        const msg = err?.error?.message;
        Swal.fire('Error', Array.isArray(msg) ? msg.join(', ') : msg || 'No se pudo crear la presentación', 'error');
      },
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
