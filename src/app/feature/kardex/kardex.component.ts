import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialService } from '../../shared/services/material.service';
import { SupplierService } from '../../shared/services/supplier.service';
import { Material } from '../../shared/models/material.model';
import { Supplier } from '../../shared/models/supplier.model';
import Swal from 'sweetalert2';
import * as ExcelJS from 'exceljs';

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
  entityType: 'material' | 'composite' | 'product' = 'material';
  clientCode = 'CYN';
  
  page = 0;
  pageSize = 6;

  // Modal Nueva Entrada
  showEntryModal = false;
  showProductEntryModal = false;
  currentStep = 1;
  productStep = 1;
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
  
  productEntryData = {
    date: new Date().toISOString().split('T')[0],
    quantity: 0,
    batchReference: '',
    unitCost: 0
  };
  
  productIngredients: any[] = [];
  
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
    private supplierService: SupplierService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Obtener codePrefix desde sessionStorage
    this.clientCode = sessionStorage.getItem('codePrefix') || 'CYN';
    
    // Verificar si viene desde productos o materiales compuestos
    this.route.queryParams.subscribe(params => {
      if (params['type'] && params['code']) {
        this.entityType = params['type'];
        const fullCode = params['code'];
        
        // Si el código ya tiene el formato completo (JMY-T-00005)
        if (fullCode.includes('-')) {
          const codeParts = fullCode.split('-');
          if (codeParts.length >= 3) {
            this.clientCode = codeParts[0];
            this.searchTerm = codeParts[2];
          }
        } else {
          // Si solo viene el número
          this.searchTerm = fullCode;
        }
        
        this.searchType = 'code';
        setTimeout(() => this.search(), 100);
      }
    });
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

    // Cargar según el tipo de entidad
    if (this.entityType === 'material') {
      this.searchMaterials();
    } else if (this.entityType === 'composite') {
      this.searchCompositeMaterials();
    } else if (this.entityType === 'product') {
      this.searchProducts();
    }
  }

  searchMaterials(): void {
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
            measureUnit: m.measurementUnit,
            entityType: 'material'
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

  searchCompositeMaterials(): void {
    this.materialService.getTransformedMaterials().subscribe({
      next: (response) => {
        this.materials = response.map((m: any) => ({
          id: m.strId,
          code: m.strCode || 'N/A',
          name: m.strName,
          supplier: 'N/A',
          location: m.strLocation,
          stockMin: m.ingMinStock,
          stockMax: m.ingMaxStock,
          balance: m.ingQuantity || 0,
          price: m.fltPrice,
          measureUnit: m.strUnitMeasure,
          entityType: 'composite'
        }));
        this.performSearch();
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los materiales compuestos', 'error');
      }
    });
  }

  searchProducts(): void {
    this.http.get<any>(`${this.baseUrl}/products`).subscribe({
      next: (response) => {
        const products = response.data || response;
        this.materials = products.map((p: any) => ({
          id: p.strId,
          code: p.strCode || 'N/A',
          name: p.strName,
          supplier: 'N/A',
          location: p.strLocation,
          stockMin: p.ingStockMin,
          stockMax: p.ingStockMax,
          balance: p.ingQuantity || 0,
          price: p.fltPrice,
          measureUnit: p.strMeasurementUnit,
          entityType: 'product'
        }));
        this.performSearch();
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los productos', 'error');
      }
    });
  }

  performSearch(): void {
    let searchValue = this.searchTerm;
    
    // Autocompletar con ceros si es búsqueda por código
    if (this.searchType === 'code' && searchValue) {
      // Verificar si el código ya tiene algún prefijo
      const hasPrefix = searchValue.includes('-M-') || searchValue.includes('-T-') || searchValue.includes('-P-');
      
      if (!hasPrefix) {
        searchValue = searchValue.padStart(5, '0');
        this.searchTerm = searchValue;
      }
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
      Swal.fire('No encontrado', 'No se encontró ningún registro con los criterios de búsqueda', 'info');
    }
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.selectedMaterial = null;
    this.movements = [];
    this.materials = [];
  }

  onSearchTypeChange(): void {
    this.searchTerm = '';
  }

  onEntityTypeChange(): void {
    this.searchTerm = '';
    this.selectedMaterial = null;
    this.movements = [];
    this.materials = [];
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
        this.closeEntryModal();
        Swal.fire('Éxito', 'Entrada registrada correctamente', 'success');
        // Recargar movimientos (esto actualizará automáticamente el balance y precio)
        this.loadMovements(this.selectedMaterial.id);
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
    if (this.selectedMaterial.entityType === 'material') {
      this.loadMaterialMovements(materialId);
    } else if (this.selectedMaterial.entityType === 'composite') {
      this.loadCompositeMovements(materialId);
    } else if (this.selectedMaterial.entityType === 'product') {
      this.loadProductMovements(materialId);
    }
  }

  loadMaterialMovements(materialId: string): void {
    const purchases$ = this.http.get<any[]>(`${this.baseUrl}/purchases/material/${materialId}`);
    const inventoryMovements$ = this.http.get<any[]>(`${this.baseUrl}/inventory-movements/material/${materialId}`);

    Promise.all([purchases$.toPromise(), inventoryMovements$.toPromise()]).then(([purchases, inventoryMovements]) => {
      this.processMovements(purchases, inventoryMovements);
      // Actualizar balance y precio del material desde el último movimiento
      if (this.movements.length > 0) {
        const lastMovement = this.movements[0];
        this.selectedMaterial.balance = lastMovement.balanceQuantity;
        this.selectedMaterial.price = lastMovement.balanceUnitValue;
      }
    }).catch(() => {
      this.movements = [];
    });
  }

  loadCompositeMovements(materialId: string): void {
    // Cargar movimientos desde inventory_movements
    this.http.get<any[]>(`${this.baseUrl}/inventory-movements/transformed-material/${materialId}`).subscribe({
      next: (movements) => {
        const allMovements: any[] = [];
        
        if (movements && movements.length > 0) {
          movements.forEach(movement => {
            allMovements.push({
              date: movement.dtmDate || movement.dtmCreationDate,
              datetime: new Date(movement.dtmCreationDate).getTime(),
              type: movement.strType === 'IN' ? 'entry' : 'output',
              quantity: movement.fltQuantity,
              unitValue: movement.fltUnitPrice,
              totalPrice: movement.fltQuantity * movement.fltUnitPrice,
              supplier: movement.strType === 'IN' ? 'Producción Interna' : '',
              concept: movement.strNotes || (movement.strType === 'IN' ? 'Entrada por producción' : 'Salida'),
              balanceQuantity: 0,
              balanceUnitValue: 0,
              balancePrice: 0
            });
          });
        }
        
        this.calculateBalances(allMovements);
      },
      error: () => {
        this.movements = [];
      }
    });
  }

  calculateBalances(allMovements: any[]): void {
    // Ordenar por fecha y hora ascendente para calcular saldos
    allMovements.sort((a, b) => a.datetime - b.datetime);

    // Calcular saldos con precio promedio ponderado
    let runningBalance = 0;
    let runningValue = 0;
    
    allMovements.forEach(mov => {
      if (mov.type === 'entry') {
        runningBalance += Number(mov.quantity) || 0;
        runningValue += Number(mov.totalPrice) || 0;
      } else if (mov.type === 'output') {
        const avgPrice = runningBalance > 0 ? runningValue / runningBalance : (Number(mov.unitValue) || 0);
        runningBalance -= Number(mov.quantity) || 0;
        runningValue -= (Number(mov.quantity) || 0) * avgPrice;
      }
      
      mov.balanceQuantity = runningBalance;
      mov.balanceUnitValue = runningBalance > 0 ? runningValue / runningBalance : 0;
      mov.balancePrice = runningValue;
    });

    // Ordenar por fecha y hora descendente para mostrar
    allMovements.sort((a, b) => b.datetime - a.datetime);

    this.movements = allMovements;
    this.page = 0;
  }

  loadProductMovements(materialId: string): void {
    const entries$ = this.http.get<any[]>(`${this.baseUrl}/products/${materialId}/movements`);
    const outputs$ = this.http.get<any[]>(`${this.baseUrl}/inventory-movements/product/${materialId}`);

    Promise.all([entries$.toPromise(), outputs$.toPromise()]).then(([entries, outputs]) => {
      this.processMovements(entries, outputs);
    }).catch(() => {
      this.movements = [];
    });
  }

  processMovements(entries: any[] | undefined, outputs: any[] | undefined): void {
    const allMovements: any[] = [];

    // Agregar entradas
    if (entries) {
      entries.forEach(entry => {
        allMovements.push({
          date: entry.dtmDate || entry.dtmCreationDate,
          datetime: new Date(entry.dtmCreationDate).getTime(),
          type: 'entry',
          quantity: entry.fltQuantity || entry.ingQuantity,
          unitValue: entry.fltUnitPrice || entry.fltPrice,
          totalPrice: (entry.fltQuantity || entry.ingQuantity) * (entry.fltUnitPrice || entry.fltPrice),
          supplier: entry.supplier?.strName || 'Producción Interna',
          concept: entry.strNotes || 'Entrada por producción',
          balanceQuantity: 0,
          balanceUnitValue: 0,
          balancePrice: 0
        });
      });
    }

    // Agregar salidas
    if (outputs) {
      outputs.forEach(output => {
        allMovements.push({
          date: output.dtmDate || output.dtmCreationDate,
          datetime: new Date(output.dtmCreationDate).getTime(),
          type: 'output',
          quantity: output.fltQuantity,
          unitValue: output.fltUnitPrice,
          totalPrice: output.fltQuantity * output.fltUnitPrice,
          supplier: '',
          concept: output.strNotes || 'Salida',
          balanceQuantity: 0,
          balanceUnitValue: 0,
          balancePrice: 0
        });
      });
    }

    // Ordenar por fecha y hora ascendente para calcular saldos
    allMovements.sort((a, b) => a.datetime - b.datetime);

    // Calcular saldos con precio promedio ponderado
    let runningBalance = 0;
    let runningValue = 0;
    
    allMovements.forEach(mov => {
      if (mov.type === 'entry') {
        runningBalance += Number(mov.quantity) || 0;
        runningValue += Number(mov.totalPrice) || 0;
      } else if (mov.type === 'output') {
        const avgPrice = runningBalance > 0 ? runningValue / runningBalance : (Number(mov.unitValue) || 0);
        runningBalance -= Number(mov.quantity) || 0;
        runningValue -= (Number(mov.quantity) || 0) * avgPrice;
      }
      
      mov.balanceQuantity = runningBalance;
      mov.balanceUnitValue = runningBalance > 0 ? runningValue / runningBalance : 0;
      mov.balancePrice = runningValue;
    });

    // Ordenar por fecha y hora descendente para mostrar
    allMovements.sort((a, b) => b.datetime - a.datetime);

    this.movements = allMovements;
    this.page = 0;
  }

  newEntry(): void {
    if (!this.selectedMaterial) {
      Swal.fire('Advertencia', 'Por favor seleccione un registro primero', 'warning');
      return;
    }
    
    if (this.entityType === 'composite') {
      this.router.navigate(['/materials'], { 
        queryParams: { 
          edit: this.selectedMaterial.id, 
          step: 3 
        } 
      });
    } else if (this.entityType === 'product') {
      this.loadProductIngredients();
      this.showProductEntryModal = true;
    } else {
      this.showEntryModal = true;
      this.currentStep = 1;
      this.loadSuppliers();
    }
  }

  loadProductIngredients(): void {
    const productId = this.selectedMaterial.id;
    
    this.http.get<any[]>(`${this.baseUrl}/products/${productId}/ingredients`).subscribe({
      next: (ingredients) => {
        this.productIngredients = ingredients.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          stock: ing.stock,
          unitPrice: ing.unitPrice,
          type: ing.type
        }));
        
        console.log('Ingredientes cargados:', this.productIngredients);
        this.calculateProductCost();
      },
      error: (err) => {
        console.error('Error cargando ingredientes:', err);
        this.productIngredients = [];
      }
    });
  }

  closeProductEntryModal(): void {
    this.showProductEntryModal = false;
    this.productStep = 1;
    this.productEntryData = {
      date: new Date().toISOString().split('T')[0],
      quantity: 0,
      batchReference: '',
      unitCost: 0
    };
    this.productIngredients = [];
  }

  calculateProductCost(): void {
    let totalCost = 0;
    this.productIngredients.forEach(ing => {
      const cost = ing.quantity * ing.unitPrice;
      console.log(`${ing.name}: ${ing.quantity} × ${ing.unitPrice} = ${cost}`);
      totalCost += cost;
    });
    this.productEntryData.unitCost = totalCost;
    console.log('Costo unitario total:', totalCost);
  }

  canProceedProductStep(): boolean {
    if (this.productStep === 1) {
      const hasDate = !!this.productEntryData.date;
      const hasQuantity = this.productEntryData.quantity > 0;
      const hasStock = this.productIngredients.every(ing => ing.stock >= (ing.quantity * this.productEntryData.quantity));
      return hasDate && hasQuantity && hasStock;
    }
    return false;
  }

  productNextStep(): void {
    if (this.productStep < 2) {
      this.productStep++;
    }
  }

  productPreviousStep(): void {
    if (this.productStep > 1) {
      this.productStep--;
    }
  }

  saveProductEntry(): void {
    if (this.productEntryData.quantity <= 0) {
      Swal.fire('Error', 'La cantidad debe ser mayor a 0', 'error');
      return;
    }

    const productionData = {
      productId: this.selectedMaterial.id,
      date: this.productEntryData.date,
      quantity: this.productEntryData.quantity,
      batchReference: this.productEntryData.batchReference
    };

    this.http.post(`${this.baseUrl}/products/production`, productionData).subscribe({
      next: (response: any) => {
        // Actualizar el balance del producto
        if (response.product) {
          this.selectedMaterial.balance = parseFloat(response.product.ingQuantity.toString());
        }
        
        // Recargar movimientos
        this.loadMovements(this.selectedMaterial.id);
        
        Swal.fire('Éxito', 'Producción registrada correctamente', 'success');
        this.closeProductEntryModal();
      },
      error: () => {
        Swal.fire('Error', 'No se pudo registrar la producción', 'error');
      }
    });
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

  async exportToExcel(): Promise<void> {
    if (!this.selectedMaterial || this.movements.length === 0) {
      Swal.fire('Advertencia', 'No hay datos para exportar', 'warning');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Kardex');

    // Encabezado del material
    worksheet.mergeCells('A1:L1');
    worksheet.getCell('A1').value = `KARDEX - ${this.selectedMaterial.name}`;
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.getCell('A2').value = `Código: ${this.selectedMaterial.code}`;
    worksheet.getCell('A3').value = `Ubicación: ${this.selectedMaterial.location}`;
    worksheet.getCell('A4').value = `Stock Actual: ${this.formatNumber(this.selectedMaterial.balance)}`;

    // Encabezados de tabla - Fila 1
    const headerRow1 = worksheet.getRow(6);
    headerRow1.values = ['Fecha', 'ENTRADAS', '', '', '', 'SALIDAS', '', '', '', 'SALDOS', '', ''];
    headerRow1.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow1.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0d6efd' } };
    headerRow1.height = 25;

    // Merge cells para encabezados principales
    worksheet.mergeCells('B6:E6'); // ENTRADAS
    worksheet.mergeCells('F6:I6'); // SALIDAS
    worksheet.mergeCells('J6:L6'); // SALDOS

    // Encabezados de tabla - Fila 2
    const headerRow2 = worksheet.getRow(7);
    headerRow2.values = ['', 'Cantidad', 'Valor unitario', 'Precio', 'Proveedor', 'Cantidad', 'Valor unitario', 'Precio', 'Concepto', 'Cantidad', 'Valor unitario', 'Precio'];
    headerRow2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow2.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0d6efd' } };
    headerRow2.height = 25;

    // Datos
    let rowIndex = 8;
    this.movements.forEach(mov => {
      const row = worksheet.getRow(rowIndex);
      row.values = [
        new Date(mov.date).toLocaleDateString('es-CO'),
        mov.type === 'entry' ? mov.quantity : '',
        mov.type === 'entry' ? mov.unitValue : '',
        mov.type === 'entry' ? mov.totalPrice : '',
        mov.type === 'entry' ? mov.supplier : '',
        mov.type === 'output' ? mov.quantity : '',
        mov.type === 'output' ? mov.unitValue : '',
        mov.type === 'output' ? mov.totalPrice : '',
        mov.type === 'output' ? mov.concept : '',
        mov.balanceQuantity,
        mov.balanceUnitValue,
        mov.balancePrice
      ];

      // Aplicar colores de fondo
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      for (let i = 2; i <= 5; i++) {
        row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } };
      }
      for (let i = 6; i <= 9; i++) {
        row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4E6' } };
      }
      for (let i = 10; i <= 12; i++) {
        row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      }

      // Alineación y bordes
      row.eachCell((cell) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
        };
      });

      rowIndex++;
    });

    // Aplicar bordes a encabezados
    [6, 7].forEach(rowNum => {
      const row = worksheet.getRow(rowNum);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        };
      });
    });

    // Ajustar anchos de columna
    worksheet.columns = [
      { width: 12 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 20 },
      { width: 12 }, { width: 15 }, { width: 15 }, { width: 40 },
      { width: 12 }, { width: 15 }, { width: 15 }
    ];

    // Generar y descargar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kardex_${this.selectedMaterial.code}_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
