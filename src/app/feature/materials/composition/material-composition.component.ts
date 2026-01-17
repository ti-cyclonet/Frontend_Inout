import { Component, OnInit, Input, OnChanges, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NumberFormatPipe } from '../../../shared/pipes/number-format.pipe';
import { MaterialService } from '../../../shared/services/material.service';
import { Material, MaterialComposition, MaterialImage } from '../../../shared/models/material.model';
import { ImageManagerComponent } from '../../../shared/components/image-manager/image-manager.component';

@Component({
  selector: 'app-material-composition',
  standalone: true,
  imports: [CommonModule, FormsModule, NumberFormatPipe, ImageManagerComponent],
  templateUrl: './material-composition.component.html',
  styles: [`
    .materials-list-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #f8f9fa;
    }
    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: white;
      border-bottom: 1px solid #e9ecef;
      flex-shrink: 0;
    }
    .title-container {
      display: flex;
      align-items: center;
      font-size: 1rem;
      color: #6E6E6E;
    }
    .title-container svg {
      width: 20px;
      height: 20px;
      margin-right: 0.3rem;
      fill: #6E6E6E;
    }
    .title-link {
      display: flex;
      align-items: center;
      color: #6E6E6E;
      text-decoration: none;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .view-toggle {
      display: flex;
      border-radius: 6px;
      overflow: hidden;
    }
    .view-toggle .btn {
      border-radius: 0;
      border-right: none;
    }
    .view-toggle .btn:last-child {
      border-right: 1px solid #dee2e6;
    }
    .filters-panel {
      background: white;
      border-bottom: 1px solid #e9ecef;
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }
    .filters-panel.show {
      max-height: 200px;
    }
    .filters-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      padding: 1rem 1.5rem;
      align-items: end;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .filter-group label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #495057;
    }
    .form-control, .form-select {
      padding: 0.5rem 0.75rem;
      border: 1px solid #ced4da;
      border-radius: 6px;
      font-size: 0.875rem;
    }
    .filter-actions {
      display: flex;
      align-items: end;
    }
    .table-container {
      flex: 1;
      overflow: auto;
      background: white;
    }
    .materials-table {
      margin: 0;
      width: 100%;
    }
    .materials-table th {
      background: #f8f9fa;
      border-bottom: 2px solid #dee2e6;
      font-weight: 600;
      font-size: 0.875rem;
      padding: 1rem 0.75rem;
      white-space: nowrap;
    }
    .materials-table td {
      padding: 1rem 0.75rem;
      vertical-align: middle;
      border-bottom: 1px solid #e9ecef;
    }
    .checkbox-col {
      width: 40px;
    }
    .material-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .material-fallback {
      width: 40px;
      height: 40px;
      border-radius: 6px;
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .material-fallback svg {
      width: 20px;
      height: 20px;
      fill: #6c757d;
    }
    .material-name strong {
      color: #333;
      font-size: 0.875rem;
    }
    .material-name small {
      font-size: 0.75rem;
    }
    .description-text {
      font-size: 0.875rem;
      color: #6c757d;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .component-count {
      font-size: 0.875rem;
      color: #6c757d;
    }
    .stock-info {
      font-size: 0.875rem;
    }
    .stock-value {
      font-weight: 600;
    }
    .price-value {
      font-weight: 600;
      color: #333;
    }
    .status-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
    }
    .status-active {
      background: #d4edda;
      color: #155724;
    }
    .action-buttons {
      display: flex;
      gap: 0.25rem;
    }
    .action-buttons .btn {
      padding: 0.25rem 0.5rem;
    }
    .action-buttons svg {
      width: 14px;
      height: 14px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      border: 1px solid transparent;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn svg {
      width: 16px;
      height: 16px;
    }
    .btn-primary {
      background-color: #007bff;
      color: white;
      border-color: #007bff;
    }
    .btn-outline-primary {
      color: #007bff;
      border-color: #007bff;
      background-color: transparent;
    }
    .btn-outline-secondary {
      color: #6c757d;
      border-color: #6c757d;
      background-color: transparent;
    }
    .btn-outline-danger {
      color: #dc3545;
      border-color: #dc3545;
      background-color: transparent;
    }
    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
    .btn-sm svg {
      width: 14px;
      height: 14px;
    }
    .loading-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
    }
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e9ecef;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      text-align: center;
    }
    .empty-icon {
      width: 64px;
      height: 64px;
      fill: #6c757d;
      margin-bottom: 1rem;
    }
    .empty-state h3 {
      color: #333;
      margin-bottom: 0.5rem;
    }
    .empty-state p {
      color: #6c757d;
      margin-bottom: 1.5rem;
    }
    .cards-container {
      flex: 1;
      overflow: auto;
      padding: 1rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }
    .material-card {
      background: white;
      border-radius: 8px;
      border: 1px solid #e9ecef;
      overflow: hidden;
      transition: all 0.2s ease;
    }
    .material-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #e9ecef;
    }
    .card-content {
      padding: 1rem;
    }
    .material-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    .stat {
      text-align: center;
    }
    .stat label {
      display: block;
      font-size: 0.75rem;
      color: #6c757d;
      margin-bottom: 0.25rem;
      text-transform: uppercase;
      font-weight: 500;
    }
    .stat .value {
      font-weight: 600;
      font-size: 0.875rem;
      color: #333;
    }
    .card-actions {
      display: flex;
      gap: 0.5rem;
      padding: 1rem;
      border-top: 1px solid #e9ecef;
      background: #f8f9fa;
    }
    .card-actions .btn {
      flex: 1;
      font-size: 0.875rem;
    }
    .stock-low {
      color: #dc3545 !important;
    }
    .stock-normal {
      color: #28a745 !important;
    }
    .stock-high {
      color: #007bff !important;
    }
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1050;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal.show {
      display: flex;
    }
    .modal-dialog {
      position: relative;
      width: 100%;
      max-width: 1140px;
      margin: 0 auto;
      pointer-events: none;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-xl {
      max-width: 1140px;
    }
    .modal-content {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 100%;
      pointer-events: auto;
      background-color: #fff;
      background-clip: padding-box;
      border: 1px solid rgba(0,0,0,.2);
      border-radius: 0.3rem;
      outline: 0;
    }
    .modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 1rem 1rem;
      border-bottom: 1px solid #dee2e6;
      border-top-left-radius: calc(0.3rem - 1px);
      border-top-right-radius: calc(0.3rem - 1px);
    }
    .modal-title {
      margin-bottom: 0;
      line-height: 1.5;
      font-size: 1.25rem;
      font-weight: 500;
    }
    .btn-close {
      padding: 0.25rem 0.25rem;
      margin: -0.25rem -0.25rem -0.25rem auto;
      background: transparent;
      border: 0;
      border-radius: 0.25rem;
      opacity: 0.5;
      cursor: pointer;
    }
    .modal-body {
      position: relative;
      flex: 1 1 auto;
      padding: 1rem;
    }
    .modal-footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      padding: 0.75rem;
      border-top: 1px solid #dee2e6;
      border-bottom-right-radius: calc(0.3rem - 1px);
      border-bottom-left-radius: calc(0.3rem - 1px);
      gap: 0.5rem;
    }
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 1040;
      width: 100vw;
      height: 100vh;
      background-color: #000;
      opacity: 0.5;
    }
    .step-indicator {
      display: flex;
      justify-content: center;
      margin-bottom: 2rem;
    }
    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin: 0 1rem;
      position: relative;
    }
    .step-number {
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: #e9ecef;
      color: #6c757d;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .step.active .step-number {
      background: #007bff;
      color: white;
    }
    .step.completed .step-number {
      background: #28a745;
      color: white;
    }
    .step-label {
      font-size: 0.875rem;
      color: #6c757d;
      text-align: center;
    }
    .step.active .step-label {
      color: #007bff;
      font-weight: 600;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
    }
    .form-group.full-width {
      grid-column: 1 / -1;
    }
    .form-group label {
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: #495057;
    }
    .image-upload-container {
      margin-top: 0.5rem;
    }
    .drop-zone {
      border: 2px dashed #dee2e6;
      border-radius: 8px;
      padding: 2rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #f8f9fa;
    }
    .drop-zone:hover {
      border-color: #007bff;
      background: #e3f2fd;
    }
    .drop-zone.drag-over {
      border-color: #007bff;
      background: #e3f2fd;
    }
    .upload-icon {
      width: 48px;
      height: 48px;
      fill: #6c757d;
      margin-bottom: 1rem;
    }
    .drop-zone p {
      margin: 0 0 0.5rem 0;
      color: #495057;
      font-weight: 500;
    }
    .drop-zone small {
      color: #6c757d;
    }
    .file-input {
      display: none;
    }
    .image-preview {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }
    .preview-item {
      position: relative;
      width: 80px;
      height: 80px;
    }
    .preview-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #dee2e6;
    }
    .remove-btn {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #dc3545;
      color: white;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
    }
    .step-content {
      min-height: 400px;
    }
    .ingredient-form {
      margin-bottom: 2rem;
    }
    .filters-section {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }
    .filters-section h5 {
      margin-bottom: 1rem;
      color: #495057;
    }
    .materials-list {
      border: 1px solid #dee2e6;
      border-radius: 8px;
      overflow: hidden;
    }
    .materials-grid {
      max-height: 300px;
      overflow-y: auto;
    }
    .material-item {
      display: flex;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #e9ecef;
      transition: background-color 0.2s;
    }
    .material-item:hover {
      background-color: #f8f9fa;
    }
    .material-item.selected {
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 4px;
    }
    .material-item.disabled {
      opacity: 0.6;
      pointer-events: none;
      background-color: #f8f9fa;
    }
    .material-checkbox {
      margin-right: 1rem;
    }
    .material-info {
      flex: 1;
    }
    .material-name {
      font-weight: 600;
      color: #333;
      margin-bottom: 0.25rem;
    }
    .material-location {
      font-size: 0.875rem;
      color: #6c757d;
    }
    .material-stock-info {
      font-size: 0.75rem;
      color: #6c757d;
    }
    .stock-min {
      margin-right: 1rem;
    }
    .material-stock {
      color: #28a745;
    }
    .material-quantity {
      width: 120px;
    }
    .quantity-input {
      width: 100%;
      padding: 0.25rem 0.5rem;
      border: 1px solid #ced4da;
      border-radius: 4px;
    }
    .stock-warning {
      font-size: 0.75rem;
      color: #dc3545;
      margin-top: 0.25rem;
    }
    .pagination-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: #f8f9fa;
      border-top: 1px solid #dee2e6;
    }
    .page-info {
      font-size: 0.875rem;
      color: #6c757d;
    }
    .add-selected {
      padding: 1rem;
      background: #f8f9fa;
      border-top: 1px solid #dee2e6;
      text-align: center;
    }
    .ingredients-list {
      margin-top: 2rem;
    }
    .ingredients-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      overflow: hidden;
    }
    .ingredients-table th {
      background: #f8f9fa;
      padding: 0.75rem;
      text-align: left;
      font-weight: 600;
      border-bottom: 1px solid #dee2e6;
    }
    .ingredients-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #e9ecef;
    }
    .ingredient-name {
      font-weight: 500;
    }
    .ingredient-quantity {
      color: #6c757d;
    }
    .ingredient-cost {
      font-weight: 600;
      color: #28a745;
    }
    .edit-input {
      width: 80px;
      padding: 0.25rem;
      border: 1px solid #ced4da;
      border-radius: 4px;
    }
    .summary-card {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 1.5rem;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid #e9ecef;
    }
    .summary-row:last-child {
      border-bottom: none;
    }
    .summary-row label {
      font-weight: 600;
      color: #495057;
      margin: 0;
    }
    .summary-row span {
      color: #333;
      font-weight: 500;
    }
    .cost-highlight {
      color: #28a745;
      font-weight: 700;
      font-size: 1.1em;
    }
    .unit-price {
      color: #007bff;
      font-weight: 600;
    }
    .calculated-quantity {
      color: #6c757d;
      font-weight: 600;
    }
    .summary-input {
      width: 120px;
      padding: 0.375rem 0.75rem;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 0.875rem;
    }
  `]
})
export class MaterialCompositionComponent implements OnInit, OnChanges {
  @Input() externalModalControl = false;
  transformedMaterials: any[] = [];
  availableMaterials: Material[] = [];
  compositions: MaterialComposition[] = [];
  loading = true; // Inicializar como true para mostrar loading al inicio
  saving = false;
  showCreateModal = false;
  currentStep = 1;
  
  // New material form
  newMaterial = {
    name: '',
    description: '',
    measurementUnit: '',
    ubicacion: '',
    stockMin: 0,
    stockMax: 100,
    quantityToGenerate: 1
  };
  
  // Form state
  selectedMaterialId: number | null = null;
  quantity: number = 1;
  
  // Filters
  nameFilter: string = '';
  locationFilter: string = '';
  availableLocations: string[] = [];
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 5;
  
  // Selection
  selectedMaterials: Map<number, number> = new Map();
  
  // Editing
  editingComposition: number | null = null;
  tempQuantity: number = 0;
  
  // UI State
  showFilters = false;
  viewMode: 'table' | 'cards' = 'table';
  searchFilter = '';
  statusFilter = 'all';
  
  // Image handling
  materialImages: MaterialImage[] = [];

  constructor(private materialService: MaterialService) {}

  ngOnInit(): void {
    this.loadAvailableMaterials();
    this.loadTransformedMaterials();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Solo abrir modal si se controla externamente Y es diferente de false
    if (changes['externalModalControl'] && 
        changes['externalModalControl'].currentValue === true &&
        !changes['externalModalControl'].firstChange) {
      this.showCreateModal = true;
    }
  }

  loadTransformedMaterials(): void {
    this.loading = true;
    this.materialService.getTransformedMaterials().subscribe({
      next: (response) => {
        this.transformedMaterials = response.map((item: any) => ({
          id: item.strId,
          name: item.strName,
          description: item.strDescription,
          componentCount: item.compositions ? item.compositions.length : 0,
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
        }));
        
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
    if (this.currentStep < 3) {
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
        return this.compositions.length > 0;
      default:
        return false;
    }
  }

  closeModal(): void {
    this.showCreateModal = false;
    this.currentStep = 1;
    this.resetAll();
    // Reset external control
    if (this.externalModalControl) {
      this.externalModalControl = false;
    }
  }

  createTransformedMaterial(): void {
    if (!this.isFormValid()) return;
    
    this.saving = true;
    
    const materialData = {
      strName: this.newMaterial.name,
      strDescription: this.newMaterial.description,
      strUnitMeasure: this.newMaterial.measurementUnit,
      fltPrice: this.getUnitPrice(),
      ingMinStock: this.newMaterial.stockMin,
      ingMaxStock: this.newMaterial.stockMax,
      ingQuantity: this.getTotalQuantity(),
      strLocation: this.newMaterial.ubicacion,
      strStatus: 'Active',
      composition: this.compositions.map(comp => ({
        componentMaterialId: comp.componentMaterialId,
        quantity: comp.quantity
      })),
      images: this.materialImages
    };

    this.materialService.createTransformedMaterial(materialData).subscribe({
      next: (createdMaterial) => {
        // Actualizar stock de materiales utilizados
        this.updateMaterialsStock();
        this.saving = false;
        this.closeModal();
        this.loadTransformedMaterials();
      },
      error: (error) => {
        console.error('Error completo:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.error);
        alert('Error del servidor: ' + (error.error?.message || 'Error interno del servidor'));
        this.saving = false;
      }
    });
  }

  private updateMaterialsStock(): void {
    this.compositions.forEach(comp => {
      const material = this.availableMaterials.find(m => m.id === comp.componentMaterialId);
      if (material) {
        const newStock = (material.currentStock || 0) - comp.quantity;
        material.currentStock = Math.max(0, newStock);
      }
    });
  }

  getTotalCost(): number {
    return this.compositions.reduce((total, comp) => {
      const materialCost = comp.componentMaterial?.price || 0;
      return total + (materialCost * comp.quantity);
    }, 0);
  }

  getTotalQuantity(): number {
    return this.compositions.reduce((total, comp) => {
      return total + comp.quantity;
    }, 0);
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

  resetAll(): void {
    this.newMaterial = {
      name: '',
      description: '',
      measurementUnit: '',
      ubicacion: '',
      stockMin: 0,
      stockMax: 100,
      quantityToGenerate: 1
    };
    this.compositions = [];
    this.selectedMaterials.clear();
    this.currentPage = 1;
    this.resetIngredientForm();
    this.materialImages = [];
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
    return this.availableMaterials.filter(material => {
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
      
      return true;
    });
  }

  clearFilters(): void {
    this.nameFilter = '';
    this.locationFilter = '';
    this.currentPage = 1;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-ES').format(value);
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
    const remainingStock = (material.currentStock || 0) - quantity;
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
}