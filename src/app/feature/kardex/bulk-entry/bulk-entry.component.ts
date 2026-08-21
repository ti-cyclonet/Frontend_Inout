import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MaterialService } from '../../../shared/services/material.service';
import { SupplierService } from '../../../shared/services/supplier.service';
import { DocumentsService } from '../../../shared/services/documents.service';
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

  constructor(
    private http: HttpClient,
    private materialService: MaterialService,
    private supplierService: SupplierService,
    private documentsService: DocumentsService
  ) {}

  ngOnInit(): void {
    this.loadSuppliers();
    this.loadMaterials();
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
  }

  clearSupplier(): void {
    this.selectedSupplier = null;
    this.supplierSearch = '';
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
    this.materialService.getMaterials(undefined, 1, 1000).subscribe({
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
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
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
