import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MaterialService } from '../../../shared/services/material.service';
import { SupplierService } from '../../../shared/services/supplier.service';
import { DocumentsService } from '../../../shared/services/documents.service';
import { CategoryService, Category } from '../../../shared/services/category/category.service';
import { WarehousesService } from '../../../shared/services/warehouses.service';
import { UNIT_OPTIONS } from '../../../shared/utils/unit-conversion.util';
import { decodeJwtPayload } from '../../../shared/utils/jwt.util';
import { Supplier } from '../../../shared/models/supplier.model';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';

interface BulkItem {
  materialId: string;
  materialName: string;
  materialCode: string;
  quantity: number;
  unitPrice: number;
  total: number;
  expirationDate: string;
}

/** Compra a medio diligenciar guardada en este navegador. */
interface PurchaseDraft {
  savedAt: number;
  supplier: Supplier | null;
  documentNumber: string;
  purchaseDate: string;
  items: BulkItem[];
}

/** Un borrador más viejo que esto ya no se ofrece. */
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface MaterialOption {
  id: string;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  price: number;
}

@Component({
  selector: 'app-bulk-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-entry.component.html',
  styleUrls: ['./bulk-entry.component.css']
})
export class BulkEntryComponent implements OnInit {
  // Description toggle (hidden by default on mobile)
  showDescription = false;

  // Supplier
  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  supplierSearch = '';
  selectedSupplier: Supplier | null = null;
  showSupplierDropdown = false;
  showCreateSupplier = false;
  newSupplier = { name: '', contactName: '', contactEmail: '', contactPhone: '', address: '', documentType: '', documentNumber: '' };

  // Document info
  documentNumber = '';
  purchaseDate = new Date().toISOString().split('T')[0];

  // Materials
  materials: MaterialOption[] = [];
  filteredMaterials: MaterialOption[] = [];
  materialSearch = '';
  showMaterialDropdown = false;

  // Current item being added
  currentItem = {
    materialId: '',
    materialName: '',
    materialCode: '',
    quantity: 0,
    totalCost: 0,
    unitPrice: 0,
    expirationDate: ''
  };

  // Items list
  items: BulkItem[] = [];
  submitting = false;

  private baseUrl = `${environment.apiUrl}/purchases`;

  // Borrador: se guarda en cada cambio y se ofrece al volver
  pendingDraft: PurchaseDraft | null = null;

  // Crear material sin salir de la compra
  showCreateMaterial = false;
  creatingMaterial = false;
  newMaterial = { name: '', unit: '', categoryId: '', location: '', stockMin: null as number | null, stockMax: null as number | null };
  unitOptions = UNIT_OPTIONS;
  categories: Category[] = [];
  locationOptions: { value: string; label: string }[] = [];

  @ViewChild('materialInput') materialInput?: ElementRef<HTMLInputElement>;
  @ViewChild('qtyInput') qtyInput?: ElementRef<HTMLInputElement>;

  constructor(
    private http: HttpClient,
    private materialService: MaterialService,
    private supplierService: SupplierService,
    private documentsService: DocumentsService,
    private categoryService: CategoryService,
    private warehousesService: WarehousesService
  ) {}

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadMaterials();
    this.pendingDraft = this.readDraft();
  }

  // --- Suppliers ---
  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (data) => { this.suppliers = data; this.filteredSuppliers = data; },
      error: () => { this.suppliers = []; }
    });
  }

  filterSuppliers(): void {
    const q = this.supplierSearch.toLowerCase();
    this.filteredSuppliers = q
      ? this.suppliers.filter(s => s.name.toLowerCase().includes(q))
      : this.suppliers;
  }

  selectSupplier(supplier: Supplier): void {
    this.selectedSupplier = supplier;
    this.supplierSearch = supplier.name;
    this.showSupplierDropdown = false;
    this.saveDraft();
  }

  clearSupplier(): void {
    this.selectedSupplier = null;
    this.supplierSearch = '';
    this.saveDraft();
  }

  toggleCreateSupplier(): void {
    this.showCreateSupplier = !this.showCreateSupplier;
  }

  createSupplier(): void {
    if (!this.newSupplier.name || !this.newSupplier.contactName) {
      Swal.fire('Error', 'Nombre y contacto son requeridos', 'error');
      return;
    }
    this.supplierService.createSupplier({ ...this.newSupplier, status: 'active' }).subscribe({
      next: (supplier) => {
        this.suppliers.push(supplier);
        this.filteredSuppliers = this.suppliers;
        this.selectSupplier(supplier);
        this.showCreateSupplier = false;
        this.newSupplier = { name: '', contactName: '', contactEmail: '', contactPhone: '', address: '', documentType: '', documentNumber: '' };
      },
      error: (err) => {
        Swal.fire('Error', err?.error?.message || 'No se pudo crear el proveedor', 'error');
      }
    });
  }

  // --- Materials ---
  loadMaterials(): void {
    this.materialService.getAllMaterials().subscribe({
      next: (response) => {
        this.materials = (response.data || []).map((m: any) => ({
          id: m.id,
          code: m.strCode || '-',
          name: m.name || '',
          unit: m.measurementUnit || 'und',
          currentStock: Number(m.currentStock) || 0,
          price: Number(m.price) || 0
        }));
        this.filteredMaterials = this.materials;
      },
      error: () => { this.materials = []; }
    });
  }

  filterMaterials(): void {
    const q = this.materialSearch.toLowerCase();
    this.filteredMaterials = q
      ? this.materials.filter(m => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
      : this.materials;
  }

  /** Lo buscado no coincide exactamente con ningún material: se ofrece crearlo. */
  get canOfferCreate(): boolean {
    const q = this.materialSearch.trim().toLowerCase();
    return q.length >= 2 && !this.currentItem.materialId && !this.materials.some(m => m.name.toLowerCase() === q);
  }

  selectMaterial(material: MaterialOption): void {
    this.currentItem.materialId = material.id;
    this.currentItem.materialName = material.name;
    this.currentItem.materialCode = material.code;
    this.materialSearch = `${material.code} - ${material.name}`;
    this.showMaterialDropdown = false;
  }

  recalcUnitPrice(): void {
    if (this.currentItem.quantity > 0 && this.currentItem.totalCost > 0) {
      this.currentItem.unitPrice = this.currentItem.totalCost / this.currentItem.quantity;
    } else {
      this.currentItem.unitPrice = 0;
    }
  }

  // --- Items ---
  canAddItem(): boolean {
    return !!(this.currentItem.materialId && this.currentItem.quantity > 0 && this.currentItem.totalCost > 0);
  }

  addItem(): void {
    if (!this.canAddItem()) return;
    const existing = this.items.find(i => i.materialId === this.currentItem.materialId);
    if (existing) {
      Swal.fire({ icon: 'warning', title: 'Duplicado', text: 'Este material ya está en la lista.' });
      return;
    }
    this.items.push({
      materialId: this.currentItem.materialId,
      materialName: this.currentItem.materialName,
      materialCode: this.currentItem.materialCode,
      quantity: this.currentItem.quantity,
      unitPrice: this.currentItem.unitPrice,
      total: this.currentItem.totalCost,
      expirationDate: this.currentItem.expirationDate
    });
    this.resetCurrentItem();
    this.saveDraft();
    // Listo para el siguiente material
    setTimeout(() => this.materialInput?.nativeElement.focus(), 0);
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
    this.saveDraft();
  }

  scrollToItems(): void {
    document.getElementById('bulk-items')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Crear material sin salir de la compra ---
  openCreateMaterial(): void {
    this.newMaterial = { name: this.materialSearch.trim(), unit: '', categoryId: '', location: this.locationOptions[0]?.value || '', stockMin: null, stockMax: null };
    this.showMaterialDropdown = false;
    this.showCreateMaterial = true;
    if (!this.categories.length) {
      this.categoryService.getAll().subscribe({ next: (c: any) => { this.categories = Array.isArray(c) ? c : (c?.data || []); }, error: () => {} });
    }
    if (!this.locationOptions.length) {
      this.warehousesService.getWarehouses().subscribe({
        next: (warehouses) => {
          const locations: { value: string; label: string }[] = [];
          for (const wh of warehouses) {
            for (const loc of wh.locations || []) locations.push({ value: loc.locationCode || loc.name, label: loc.name });
          }
          this.locationOptions = locations.length ? locations : [{ value: 'Bodega Principal', label: 'Bodega Principal' }];
          if (!this.newMaterial.location) this.newMaterial.location = this.locationOptions[0].value;
        },
        error: () => {
          this.locationOptions = [{ value: 'Bodega Principal', label: 'Bodega Principal' }];
          if (!this.newMaterial.location) this.newMaterial.location = this.locationOptions[0].value;
        }
      });
    }
  }

  closeCreateMaterial(): void {
    if (!this.creatingMaterial) this.showCreateMaterial = false;
  }

  get newMaterialError(): string {
    const m = this.newMaterial;
    if (m.name.trim().length < 2) return 'Escribe el nombre del material.';
    if (!m.unit) return 'Elige la unidad de medida.';
    if (!m.location) return 'Elige la ubicación.';
    if ((m.stockMin ?? 0) < 0 || (m.stockMax ?? 0) < 0) return 'El stock no puede ser negativo.';
    if (m.stockMax && (m.stockMin ?? 0) > m.stockMax) return 'El stock máximo debe ser mayor o igual al mínimo.';
    return '';
  }

  createMaterial(): void {
    if (this.newMaterialError || this.creatingMaterial) return;
    const m = this.newMaterial;
    const payload: any = {
      strName: m.name.trim(),
      strUnitMeasure: m.unit,
      strDischargeUnit: m.unit,
      // El costo sale de esta compra; el stock lo suma la entrada
      fltPrice: 0,
      ingQuantity: 0,
      ingMinStock: Math.round(m.stockMin || 0),
      ingMaxStock: Math.round(m.stockMax || 0),
      strLocation: m.location,
      strStatus: 'active'
    };
    if (m.categoryId) payload.categoryId = +m.categoryId;
    this.creatingMaterial = true;
    this.materialService.createMaterial(payload).subscribe({
      next: (created: any) => {
        this.creatingMaterial = false;
        this.showCreateMaterial = false;
        const option: MaterialOption = {
          id: created?.strId || created?.id,
          code: created?.strCode || '-',
          name: created?.strName || payload.strName,
          unit: created?.strUnitMeasure || payload.strUnitMeasure,
          currentStock: 0,
          price: 0
        };
        this.materials = [...this.materials, option];
        this.filteredMaterials = this.materials;
        this.selectMaterial(option);
        setTimeout(() => this.qtyInput?.nativeElement.focus(), 0);
      },
      error: (err) => {
        this.creatingMaterial = false;
        // El límite del plan ya lo muestra el LimitErrorInterceptor
        if (err?.status === 403) return;
        Swal.fire({ icon: 'error', title: 'No se pudo crear el material', text: err?.error?.message || 'Intenta de nuevo.' });
      }
    });
  }

  // --- Borrador ---
  private draftKey(): string {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token') || '';
    const tenant = (token && decodeJwtPayload(token)?.tenantId) || 'local';
    return `inout_purchase_draft_${tenant}`;
  }

  private readDraft(): PurchaseDraft | null {
    try {
      const raw = localStorage.getItem(this.draftKey());
      const d: PurchaseDraft | null = raw ? JSON.parse(raw) : null;
      if (!d || Date.now() - (d.savedAt || 0) > DRAFT_MAX_AGE_MS) { this.clearDraft(); return null; }
      return (d.items?.length || d.supplier || d.documentNumber) ? d : null;
    } catch {
      return null;
    }
  }

  /** Guarda la compra en curso; si queda vacía, borra el borrador. */
  saveDraft(): void {
    // Mientras se decide qué hacer con el borrador anterior, no se pisa
    if (this.pendingDraft) return;
    try {
      if (!this.items.length && !this.selectedSupplier && !this.documentNumber) { this.clearDraft(); return; }
      const draft: PurchaseDraft = {
        savedAt: Date.now(),
        supplier: this.selectedSupplier,
        documentNumber: this.documentNumber,
        purchaseDate: this.purchaseDate,
        items: this.items
      };
      localStorage.setItem(this.draftKey(), JSON.stringify(draft));
    } catch { /* sin almacenamiento: la compra sigue en pantalla */ }
  }

  private clearDraft(): void {
    try { localStorage.removeItem(this.draftKey()); } catch { /* nada */ }
  }

  continueDraft(): void {
    const d = this.pendingDraft;
    this.pendingDraft = null;
    if (!d) return;
    this.selectedSupplier = d.supplier;
    this.supplierSearch = d.supplier?.name || '';
    this.documentNumber = d.documentNumber || '';
    this.purchaseDate = d.purchaseDate || this.purchaseDate;
    this.items = Array.isArray(d.items) ? d.items : [];
    this.saveDraft();
  }

  discardDraft(): void {
    this.pendingDraft = null;
    this.clearDraft();
    this.saveDraft();
  }

  resetCurrentItem(): void {
    this.currentItem = { materialId: '', materialName: '', materialCode: '', quantity: 0, totalCost: 0, unitPrice: 0, expirationDate: '' };
    this.materialSearch = '';
    this.filteredMaterials = this.materials;
    this.showMaterialDropdown = false;
  }

  get grandTotal(): number {
    return this.items.reduce((sum, item) => sum + item.total, 0);
  }

  get totalQuantity(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  // --- Submit ---
  canSubmit(): boolean {
    return !!(this.selectedSupplier && this.documentNumber && this.purchaseDate && this.items.length > 0);
  }

  onSubmit(): void {
    if (!this.canSubmit() || this.submitting) return;
    this.submitting = true;

    const payload = {
      supplierId: this.selectedSupplier!.id,
      date: this.purchaseDate,
      document: this.documentNumber,
      items: this.items.map(item => ({
        materialId: item.materialId,
        materialName: item.materialName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        expirationDate: item.expirationDate || null
      }))
    };

    this.http.post(`${this.baseUrl}/bulk`, payload).subscribe({
      next: (response: any) => {
        this.submitting = false;

        // Guardar datos para el comprobante antes de resetear
        const receiptData = {
          document: this.documentNumber,
          date: this.purchaseDate,
          supplier: this.selectedSupplier!.name,
          items: this.items.map(item => ({
            materialName: item.materialName,
            materialCode: item.materialCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total
          })),
          grandTotal: this.grandTotal
        };

        this.resetForm();
        this.loadMaterials();

        Swal.fire({
          icon: 'success',
          title: 'Entrada registrada',
          html: `Se registraron <strong>${response.count}</strong> materiales del documento <strong>${response.document}</strong>`,
          confirmButtonColor: '#0066CC',
          showCancelButton: true,
          confirmButtonText: '📄 Descargar Comprobante',
          cancelButtonText: 'Cerrar'
        }).then((result) => {
          if (result.isConfirmed) {
            this.documentsService.generatePurchaseReceipt(receiptData);
          }
        });
      },
      error: (err) => {
        this.submitting = false;
        Swal.fire({ icon: 'error', title: 'Error', text: err.error?.message || 'No se pudo registrar la entrada grupal' });
      }
    });
  }

  resetForm(): void {
    this.clearDraft();
    this.items = [];
    this.selectedSupplier = null;
    this.supplierSearch = '';
    this.documentNumber = '';
    this.purchaseDate = new Date().toISOString().split('T')[0];
    this.resetCurrentItem();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
  }

  formatNumber(n: number): string {
    return new Intl.NumberFormat('es-CO').format(n || 0);
  }
}
