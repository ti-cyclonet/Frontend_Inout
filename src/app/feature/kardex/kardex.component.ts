import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MaterialService } from '../../shared/services/material.service';
import { SupplierService } from '../../shared/services/supplier.service';
import { Material } from '../../shared/models/material.model';
import { Supplier } from '../../shared/models/supplier.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-kardex',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kardex.component.html',
  styleUrls: ['./kardex.component.css']
})
export class KardexComponent implements OnInit {
  materials: any[] = [];
  selectedMaterial: any = null;
  movements: any[] = [];
  searchType = 'code';
  searchTerm = '';
  
  page = 0;
  pageSize = 6;

  // Modal Nueva Entrada
  showEntryModal = false;
  currentStep = 1;
  suppliers: Supplier[] = [];
  filteredSuppliers: Supplier[] = [];
  supplierFilter = '';
  showCreateSupplier = false;
  
  entryData = {
    date: new Date().toISOString().split('T')[0],
    quantity: 0,
    unitValue: 0,
    supplierId: '',
    document: ''
  };
  
  newSupplier = {
    name: '',
    contactName: '',
    address: '',
    documentType: '',
    documentNumber: '',
    contactEmail: '',
    contactPhone: ''
  };

  private baseUrl = 'http://localhost:3001/api';

  constructor(
    private http: HttpClient,
    private materialService: MaterialService,
    private supplierService: SupplierService
  ) {}

  ngOnInit(): void {
    // No cargar materiales automáticamente
  }

  loadMaterials(): void {
    this.materialService.getMaterials(undefined, 1, 1000).subscribe({
      next: (response) => {
        this.materials = response.data.map((m: Material) => ({
          id: m.id,
          code: m.strCode || 'N/A',
          name: m.name,
          supplier: 'N/A',
          location: m.location,
          stockMin: m.stockMin,
          stockMax: m.stockMax,
          balance: m.currentStock || 0,
          price: m.price,
          measureUnit: m.measurementUnit
        }));
        if (this.materials.length > 0) {
          this.selectedMaterial = this.materials[0];
        }
      },
      error: () => {
        // Using mock data
      }
    });
  }

  search(): void {
    if (!this.searchTerm) {
      Swal.fire('Advertencia', 'Por favor ingrese un término de búsqueda', 'warning');
      return;
    }

    // Cargar materiales si no están cargados
    if (this.materials.length === 0) {
      this.materialService.getMaterials(undefined, 1, 1000).subscribe({
        next: (response) => {
          this.materials = response.data.map((m: Material) => ({
            id: m.id,
            code: m.strCode || 'N/A',
            name: m.name,
            supplier: 'N/A',
            location: m.location,
            stockMin: m.stockMin,
            stockMax: m.stockMax,
            balance: m.currentStock || 0,
            price: m.price,
            measureUnit: m.measurementUnit
          }));
          this.performSearch();
        },
        error: () => {
          Swal.fire('Error', 'No se pudieron cargar los materiales', 'error');
        }
      });
    } else {
      this.performSearch();
    }
  }

  performSearch(): void {
    let searchValue = this.searchTerm;
    
    // Autocompletar con ceros si es búsqueda por código
    if (this.searchType === 'code' && searchValue) {
      searchValue = searchValue.padStart(5, '0');
      this.searchTerm = searchValue; // Actualizar el input con el valor formateado
      searchValue = 'JMY-M-' + searchValue;
    }
    
    const filtered = this.materials.filter(m => {
      if (this.searchType === 'code') {
        return m.code?.toLowerCase().includes(searchValue.toLowerCase());
      } else {
        return m.name?.toLowerCase() === searchValue.toLowerCase();
      }
    });
    
    if (filtered.length > 0) {
      this.selectedMaterial = filtered[0];
      this.loadMovements(filtered[0].id);
    } else {
      Swal.fire('No encontrado', 'No se encontró ningún material con los criterios de búsqueda', 'info');
    }
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.selectedMaterial = null;
    this.movements = [];
  }

  onSearchTypeChange(): void {
    this.searchTerm = '';
  }

  loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers = data;
        this.filteredSuppliers = data;
      },
      error: () => {
        this.suppliers = [];
        this.filteredSuppliers = [];
      }
    });
  }

  filterSuppliers(): void {
    this.filteredSuppliers = this.suppliers.filter(s =>
      s.name.toLowerCase().includes(this.supplierFilter.toLowerCase())
    );
  }

  toggleCreateSupplier(): void {
    this.showCreateSupplier = !this.showCreateSupplier;
  }

  createSupplier(): void {
    if (!this.newSupplier.name || !this.newSupplier.contactName) {
      Swal.fire('Error', 'Complete los campos obligatorios', 'error');
      return;
    }

    this.supplierService.createSupplier({
      ...this.newSupplier,
      status: 'active'
    }).subscribe({
      next: (supplier) => {
        this.suppliers.push(supplier);
        this.filteredSuppliers = this.suppliers;
        this.entryData.supplierId = supplier.id;
        this.showCreateSupplier = false;
        this.resetSupplierForm();
        Swal.fire('Éxito', 'Proveedor creado correctamente', 'success');
      },
      error: () => {
        Swal.fire('Error', 'No se pudo crear el proveedor', 'error');
      }
    });
  }

  resetSupplierForm(): void {
    this.newSupplier = {
      name: '',
      contactName: '',
      address: '',
      documentType: '',
      documentNumber: '',
      contactEmail: '',
      contactPhone: ''
    };
  }

  closeEntryModal(): void {
    this.showEntryModal = false;
    this.currentStep = 1;
    this.entryData = {
      date: new Date().toISOString().split('T')[0],
      quantity: 0,
      unitValue: 0,
      supplierId: '',
      document: ''
    };
    this.showCreateSupplier = false;
    this.resetSupplierForm();
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
    if (this.currentStep === 1) {
      return !!this.entryData.supplierId;
    }
    if (this.currentStep === 2) {
      return this.entryData.quantity > 0 && this.entryData.unitValue > 0 && !!this.entryData.document;
    }
    return false;
  }

  saveEntry(): void {
    // Verificar autenticación
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      Swal.fire('Error', 'Sesión expirada. Por favor inicie sesión nuevamente.', 'error');
      return;
    }

    const purchaseData = {
      materialId: this.selectedMaterial.id,
      supplierId: this.entryData.supplierId,
      date: this.entryData.date,
      quantity: this.entryData.quantity,
      unitPrice: this.entryData.unitValue,
      document: this.entryData.document
    };

    this.http.post(`${this.baseUrl}/purchases`, purchaseData).subscribe({
      next: () => {
        // Recargar el material actualizado desde el backend
        this.materialService.getMaterials(undefined, 1, 1000).subscribe({
          next: (response) => {
            const updatedMaterial = response.data.find((m: Material) => m.id === this.selectedMaterial.id);
            if (updatedMaterial) {
              this.selectedMaterial = {
                id: updatedMaterial.id,
                code: updatedMaterial.strCode || 'N/A',
                name: updatedMaterial.name,
                supplier: 'N/A',
                location: updatedMaterial.location,
                stockMin: updatedMaterial.stockMin,
                stockMax: updatedMaterial.stockMax,
                balance: updatedMaterial.currentStock || 0,
                price: updatedMaterial.price,
                measureUnit: updatedMaterial.measurementUnit
              };
            }
            // Recargar movimientos
            this.loadMovements(this.selectedMaterial.id);
            Swal.fire('Éxito', 'Entrada registrada correctamente', 'success');
            this.closeEntryModal();
          },
          error: () => {
            Swal.fire('Éxito', 'Entrada registrada correctamente', 'success');
            this.closeEntryModal();
          }
        });
      },
      error: (error) => {
        console.error('Error al guardar entrada:', error);
        Swal.fire('Error', 'No se pudo registrar la entrada', 'error');
      }
    });
  }

  getSupplierName(): string {
    return this.suppliers.find(s => s.id === this.entryData.supplierId)?.name || 'N/A';
  }

  selectMaterial(material: any): void {
    this.selectedMaterial = material;
    this.loadMovements(material.id);
  }

  loadMovements(materialId: string): void {
    const purchases$ = this.http.get<any[]>(`${this.baseUrl}/purchases/material/${materialId}`);
    const inventoryMovements$ = this.http.get<any[]>(`${this.baseUrl}/inventory-movements/material/${materialId}`);

    Promise.all([purchases$.toPromise(), inventoryMovements$.toPromise()]).then(([purchases, inventoryMovements]) => {
      const allMovements: any[] = [];

      // Agregar entradas (compras)
      if (purchases) {
        purchases.forEach(purchase => {
          allMovements.push({
            date: purchase.dtmDate,
            type: 'entry',
            quantity: purchase.fltQuantity,
            unitValue: purchase.fltUnitPrice,
            totalPrice: purchase.fltQuantity * purchase.fltUnitPrice,
            supplier: purchase.supplier?.strName || 'N/A',
            concept: '',
            balanceQuantity: 0,
            balanceUnitValue: 0,
            balancePrice: 0
          });
        });
      }

      // Agregar salidas (movimientos de inventario)
      if (inventoryMovements) {
        inventoryMovements.forEach(movement => {
          allMovements.push({
            date: movement.dtmCreationDate,
            type: 'output',
            quantity: movement.fltQuantity,
            unitValue: movement.fltUnitPrice,
            totalPrice: movement.fltQuantity * movement.fltUnitPrice,
            supplier: '',
            concept: movement.strNotes || 'Salida',
            balanceQuantity: 0,
            balanceUnitValue: 0,
            balancePrice: 0
          });
        });
      }

      // Ordenar por fecha descendente
      allMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      this.movements = allMovements;
      this.page = 0;

      // Calcular saldos
      let runningBalance = this.selectedMaterial?.balance || 0;
      this.movements.forEach(mov => {
        mov.balanceQuantity = runningBalance;
        mov.balanceUnitValue = mov.unitValue;
        mov.balancePrice = runningBalance * mov.unitValue;
        
        if (mov.type === 'entry') {
          runningBalance -= mov.quantity;
        } else if (mov.type === 'output') {
          runningBalance += mov.quantity;
        }
      });
    }).catch(() => {
      this.movements = [];
    });
  }

  newEntry(): void {
    if (!this.selectedMaterial) {
      Swal.fire('Advertencia', 'Por favor seleccione un material primero', 'warning');
      return;
    }
    this.showEntryModal = true;
    this.currentStep = 1;
    this.loadSuppliers();
  }

  newOutput(): void {
    if (!this.selectedMaterial) {
      Swal.fire('Advertencia', 'Por favor seleccione un material primero', 'warning');
      return;
    }
    Swal.fire('Información', 'Función de Nueva Salida próximamente', 'info');
  }

  get paginatedMovements() {
    const start = this.page * this.pageSize;
    return this.movements.slice(start, start + this.pageSize);
  }

  get paginatedMaterials() {
    const start = this.page * this.pageSize;
    return this.materials.slice(start, start + this.pageSize);
  }

  get totalPages() {
    return Math.ceil(this.movements.length / this.pageSize);
  }

  nextPage() {
    if (this.page < this.totalPages - 1) {
      this.page++;
    }
  }

  prevPage() {
    if (this.page > 0) {
      this.page--;
    }
  }

  formatNumber(value: number): string {
    const num = Number(value);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  getMaxRecord(): number {
    return Math.min((this.page + 1) * this.pageSize, this.movements.length);
  }

  getEmptyRows(): number[] {
    const currentPageSize = this.paginatedMovements.length;
    const emptyCount = this.pageSize - currentPageSize;
    return emptyCount > 0 ? Array(emptyCount).fill(0) : [];
  }
}
