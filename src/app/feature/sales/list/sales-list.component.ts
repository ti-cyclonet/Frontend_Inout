import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesService, Sale } from '../../../shared/services/sales.service';
import { ProductsService, Product } from '../../../shared/services/products.service';
import { KardexService } from '../../../shared/services/kardex.service';

@Component({
  selector: 'app-sales-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sales-list-container">
      <div class="list-header">
        <div class="title-container">
          <svg viewBox="0 0 16 16">
            <use xlink:href="./assets/icons/bootstrap-icons.svg#cart-check" />
          </svg>
          /Lista de Ventas
        </div>
        
        <div class="header-actions">
          <div class="search-section">
            <div class="search-box">
              <svg fill="currentcolor" viewBox="0 0 16 16" class="search-icon">
                <use xlink:href="./assets/icons/bootstrap-icons.svg#search"></use>
              </svg>
              <input type="text" placeholder="Buscar ventas..." [(ngModel)]="searchTerm" (input)="filterSales()">
            </div>
          </div>
          
          <button class="btn btn-primary" (click)="openCreateModal.emit()">
            <svg fill="currentcolor" viewBox="0 0 16 16">
              <use xlink:href="./assets/icons/bootstrap-icons.svg#plus-circle"></use>
            </svg>
            Nueva Venta
          </button>
        </div>
      </div>

      <div class="table-container" *ngIf="!loading">
        <table class="sales-table" *ngIf="filteredSales.length > 0; else noSales">
          <thead>
            <tr>
              <th>Factura</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let sale of filteredSales">
              <td>{{ sale.strInvoiceCode || 'N/A' }}</td>
              <td>{{ sale.customerName || 'N/A' }}</td>
              <td>{{ formatCurrency(sale.total || (sale.fltQuantity || 0) * (sale.fltUnitPrice || 0)) }}</td>
              <td>
                <span class="status-badge completed">
                  Completado
                </span>
              </td>
              <td>{{ sale.dtmCreationDate | date:'short' }}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn btn-sm btn-outline-primary" (click)="viewSale(sale.strId || '')">
                    <svg fill="currentcolor" viewBox="0 0 16 16">
                      <use xlink:href="./assets/icons/bootstrap-icons.svg#eye"></use>
                    </svg>
                    Ver
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <ng-template #noSales>
          <div class="empty-state">
            <svg fill="currentcolor" viewBox="0 0 16 16" class="empty-icon">
              <use xlink:href="./assets/icons/bootstrap-icons.svg#cart-x"></use>
            </svg>
            <h3>No se encontraron ventas</h3>
            <p>Crea tu primera venta para comenzar</p>
          </div>
        </ng-template>
      </div>

      <div class="loading-container" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Cargando ventas...</p>
      </div>
    </div>

    <!-- Modal Ver Venta -->
    <div class="modal fade" [class.show]="showViewModal" [style.display]="showViewModal ? 'block' : 'none'" tabindex="-1">
      <div class="modal-dialog" style="max-width: 75vw; width: 75vw;">
        <div class="modal-content">
          <div class="modal-header" style="border-bottom: 1px solid orange;">
            <h5 class="modal-title">
              Factura <span class="text-primary fw-bold">{{ selectedSale?.strInvoiceCode || 'N/A' }}</span>
              <span style="color: #ff8000">●</span>
            </h5>
            <button type="button" class="btn-close" (click)="closeViewModal()"></button>
          </div>
          <div class="modal-body" style="background-color: #f8f9fa;">
            <!-- Detalles de la venta -->
            <div *ngIf="selectedSale" class="mb-3">
              <h6 class="search-details-title">Detalles de la venta</h6>
              <div class="search-details-container">
                <table class="search-details-table">
                  <tbody>
                    <tr class="first-row">
                      <td class="stacked-cell" colspan="1">
                        <div class="label-text">Código de Factura</div>
                        <div class="value-text fw-bold">
                          {{ selectedSale.strInvoiceCode || 'N/A' }}
                        </div>
                      </td>
                      <td class="stacked-cell" colspan="1">
                        <div class="label-text">Cliente</div>
                        <div class="value-text fw-bold">
                          {{ selectedSale.customerName || 'N/A' }}
                        </div>
                      </td>
                      <td class="stacked-cell" colspan="1">
                        <div class="label-text text-center">Fecha</div>
                        <div class="value-text text-center">
                          {{ selectedSale.dtmCreationDate | date: 'dd/MM/yyyy' }}
                        </div>
                      </td>
                    </tr>
                    <tr class="second-row">
                      <td colspan="3" style="padding: 0;">
                        <table class="movements-table" style="width: 100%; margin: 0;">
                          <thead>
                            <tr class="bg-primary text-white">
                              <th class="text-center">Producto</th>
                              <th class="text-center">Cantidad</th>
                              <th class="text-center">Precio Unitario</th>
                              <th class="text-center">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr *ngFor="let item of getItems(selectedSale)" class="movement-row">
                              <td class="align-middle" style="text-align: left;">{{ item.product }}</td>
                              <td class="text-center align-middle">{{ item.quantity }}</td>
                              <td class="align-middle" style="text-align: right;">{{ formatCurrency(item.unitPrice) }}</td>
                              <td class="align-middle" style="text-align: right;">{{ formatCurrency(item.total) }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Resumen de totales -->
            <div class="mt-3 p-3" style="background-color: #e7f3ff; border-radius: 5px; border: 2px solid #0066cc;">
              <div class="row">
                <div class="col-md-4">
                  <strong>Subtotal:</strong> {{ formatCurrency(selectedSale?.subtotal || 0) }}
                </div>
                <div class="col-md-4" style="text-align: center;">
                  <strong>Impuestos:</strong> {{ formatCurrency(selectedSale?.tax || 0) }}
                </div>
                <div class="col-md-4" style="text-align: right;">
                  <strong>Total:</strong> {{ formatCurrency(selectedSale?.total || (selectedSale?.fltQuantity || 0) * (selectedSale?.fltUnitPrice || 0)) }}
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer" style="border-top: 1px solid orange">
            <button type="button" class="btn btn-outline-primary" (click)="generatePDF()">
              <svg fill="currentcolor" viewBox="0 0 16 16" style="width: 16px; height: 16px; margin-right: 0.5rem;">
                <use xlink:href="./assets/icons/bootstrap-icons.svg#file-earmark-pdf"></use>
              </svg>
              Generar PDF
            </button>
            <button type="button" class="btn btn-secondary" (click)="closeViewModal()">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-backdrop fade" [class.show]="showViewModal" *ngIf="showViewModal"></div>
  `,
  styles: [`
    .sales-list-container {
      height: calc(100vh - 200px);
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
    
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .search-section {
      flex: 1;
      max-width: 400px;
    }
    
    .search-box {
      position: relative;
    }
    
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      color: #6c757d;
    }
    
    .search-box input {
      width: 100%;
      padding: 0.5rem 0.75rem 0.5rem 2.5rem;
      border: 1px solid #ced4da;
      border-radius: 6px;
      font-size: 0.875rem;
    }
    
    .search-box input:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
    }
    
    .table-container {
      flex: 1;
      overflow: auto;
      background: white;
    }
    
    .sales-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
    }
    
    .sales-table th {
      background: #f8f9fa;
      border-bottom: 2px solid #dee2e6;
      font-weight: 700;
      font-size: 0.875rem;
      padding: 1rem 0.75rem;
      white-space: nowrap;
      color: #495057;
    }
    
    .sales-table td {
      padding: 1rem 0.75rem;
      vertical-align: middle;
      border-bottom: 1px solid #e9ecef;
    }
    
    .sales-table tbody tr:hover {
      background: #f8f9fa;
    }
    
    .status-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
    }
    
    .status-badge.completed {
      background: #d4edda;
      color: #155724;
    }
    
    .status-badge.pending {
      background: #fff3cd;
      color: #856404;
    }
    
    .status-badge.cancelled {
      background: #f8d7da;
      color: #721c24;
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
    
    .btn-primary:hover {
      background-color: #0056b3;
      border-color: #0056b3;
    }
    
    .btn-outline-primary {
      color: #007bff;
      border-color: #007bff;
      background-color: transparent;
    }
    
    .btn-outline-primary:hover {
      background-color: #007bff;
      color: white;
    }
    
    .btn-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
    }
    
    .btn-sm svg {
      width: 14px;
      height: 14px;
    }

    /* Estilos del kardex para el modal */
    .search-details-title {
      color: #0066cc;
      margin-bottom: 0.5rem;
      padding-bottom: 0.5rem;
      border-bottom: none;
    }

    .search-details-container {
      background-color: #DAE8FC;
      padding: 0;
      border: 2px solid #6C8EBF;
    }

    .search-details-table {
      width: 100%;
      margin: 0;
      border-collapse: collapse;
    }

    .search-details-table td {
      padding: 0.5rem;
      border: none;
    }

    .search-details-table .stacked-cell {
      background-color: #DAE8FC;
      padding: 0;
      vertical-align: top;
    }

    .search-details-table .stacked-cell .label-text {
      background-color: #DAE8FC;
      color: #6c757d;
      font-size: 0.85rem;
      padding: 0.25rem 0.5rem;
      border-bottom: none;
    }

    .search-details-table .stacked-cell .value-text {
      background-color: #DAE8FC;
      color: #000;
      padding: 0.5rem;
      font-weight: bold;
    }

    .balance-box {
      background-color: #000;
      color: white;
      padding: 0.5rem;
      margin: 0;
      font-weight: bold;
      display: inline-block;
      min-width: 120px;
    }

    .search-details-table .first-row {
      border-bottom: 3px solid #ff9966;
    }

    .search-details-table .first-row td {
      border-bottom: 3px solid #ff9966;
    }

    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1050;
    }
    
    .modal.show {
      display: flex !important;
      align-items: center;
      justify-content: center;
    }
    
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.5);
      z-index: 1040;
    }

    .movements-table-container {
      border: 2px solid #0066cc;
      overflow: hidden;
      width: 100%;
    }

    .movements-table {
      table-layout: fixed;
      width: 100% !important;
    }
    
    .movements-table th:nth-child(1) { width: 40% !important; }
    .movements-table th:nth-child(2) { width: 20% !important; }
    .movements-table th:nth-child(3) { width: 20% !important; }
    .movements-table th:nth-child(4) { width: 20% !important; }
    
    .movements-table td:nth-child(1) { width: 40% !important; }
    .movements-table td:nth-child(2) { width: 20% !important; }
    .movements-table td:nth-child(3) { width: 20% !important; }
    .movements-table td:nth-child(4) { width: 20% !important; }
  `]
})
export class SalesListComponent implements OnInit {
  @Input() refreshTrigger = 0;
  @Output() openCreateModal = new EventEmitter<void>();
  
  sales: Sale[] = [];
  filteredSales: Sale[] = [];
  products: Product[] = [];
  selectedSale: Sale | null = null;
  loading = false;
  searchTerm = '';
  showViewModal = false;

  constructor(private salesService: SalesService, private productsService: ProductsService, private kardexService: KardexService) {}

  ngOnInit(): void {
    this.loadSales();
    this.loadProducts();
  }

  ngOnChanges(): void {
    if (this.refreshTrigger > 0) {
      this.loadSales();
    }
  }

  loadSales(): void {
    this.loading = true;
    
    this.salesService.getSales().subscribe({
      next: (response: any) => {
        this.sales = response.data || response;
        this.filteredSales = this.sales;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sales:', error);
        this.sales = [];
        this.filteredSales = [];
        this.loading = false;
      }
    });
  }

  filterSales(): void {
    if (!this.searchTerm) {
      this.filteredSales = this.sales;
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredSales = this.sales.filter(sale => 
      (sale.customerName || '').toLowerCase().includes(term) ||
      (sale.strProductId || '').toLowerCase().includes(term)
    );
  }

  viewSale(id: string): void {
    this.selectedSale = this.sales.find(sale => sale.strId === id) || null;
    this.showViewModal = true;
    
    // Registrar movimientos en kardex si no se han registrado antes
    if (this.selectedSale) {
      this.registerKardexMovements(this.selectedSale);
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  getStatusLabel(status: string): string {
    const statusLabels: { [key: string]: string } = {
      'completed': 'Completado',
      'pending': 'Pendiente',
      'cancelled': 'Cancelado'
    };
    return statusLabels[status] || status;
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedSale = null;
  }

  loadProducts(): void {
    this.productsService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
      },
      error: (error) => {
        console.error('Error loading products:', error);
      }
    });
  }

  getProductName(productId: string): string {
    // Mock data para productos comunes
    const productNames: { [key: string]: string } = {
      '550e8400-e29b-41d4-a716-446655440000': 'Producto Premium',
      '550e8400-e29b-41d4-a716-446655440001': 'Producto Estándar',
      '550e8400-e29b-41d4-a716-446655440002': 'Producto Básico'
    };
    
    const product = this.products.find(p => p.strId === productId);
    if (product) {
      return product.strName;
    }
    
    return productNames[productId] || 'Producto no encontrado';
  }

  getItems(sale: Sale): any[] {
    if (!sale.items) return [];
    try {
      return typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items;
    } catch {
      return [];
    }
  }

  getItemsText(sale: Sale): string {
    const items = this.getItems(sale);
    return items.map(item => item.product).join(', ');
  }

  generatePDF(): void {
    if (!this.selectedSale) return;

    // Crear contenido HTML para imprimir
    const printContent = `
      <html>
        <head>
          <title>Factura ${this.selectedSale.strInvoiceCode || 'N/A'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { color: #0066cc; font-size: 18px; font-weight: bold; margin-bottom: 20px; }
            .details-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .details-table td { padding: 10px; border: 1px solid #6C8EBF; background-color: #DAE8FC; }
            .products-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .products-table th { background-color: #0066cc; color: white; padding: 10px; text-align: center; }
            .products-table td { padding: 10px; border: 1px solid #ddd; }
            .totals { background-color: #e7f3ff; padding: 15px; border: 2px solid #0066cc; }
            .text-left { text-align: left; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 12px; color: #666;">
            <div>${new Date().toLocaleDateString('en-US')} ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
            <div>Factura ${this.selectedSale.strInvoiceCode || 'N/A'}</div>
            <div>JimmyJon S. A. S.</div>
          </div>
          
          <div class="header">Factura ${this.selectedSale.strInvoiceCode || 'N/A'}</div>
          <hr style="border: 1px solid #0066cc; margin-bottom: 20px;">
          
          <h3>Detalles de la venta</h3>
          <table class="details-table">
            <tr>
              <td><strong>Cliente:</strong><br>${this.selectedSale.customerName || 'N/A'}</td>
              <td><strong>Fecha:</strong><br>${new Date(this.selectedSale.dtmCreationDate || '').toLocaleDateString('es-ES')}</td>
            </tr>
          </table>
          
          <table class="products-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unitario</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${this.getItems(this.selectedSale).map(item => `
                <tr>
                  <td class="text-left">${item.product}</td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-right">${this.formatCurrencyForPDF(item.unitPrice)}</td>
                  <td class="text-right">${this.formatCurrencyForPDF(item.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <div style="display: flex; justify-content: space-between;">
              <div><strong>Subtotal:</strong> ${this.formatCurrencyForPDF(this.selectedSale.subtotal || 0)}</div>
              <div style="text-align: center;"><strong>Impuestos:</strong> ${this.formatCurrencyForPDF(this.selectedSale.tax || 0)}</div>
              <div style="text-align: right;"><strong>Total:</strong> ${this.formatCurrencyForPDF(this.selectedSale.total || 0)}</div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  }

  formatCurrencyForPDF(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  registerKardexMovements(sale: Sale): void {
    const items = this.getItems(sale);
    
    items.forEach(item => {
      const movement = {
        entityId: sale.strProductId || '',
        entityType: 'product' as const,
        movementType: 'output' as const,
        quantity: item.quantity,
        unitValue: item.unitPrice,
        totalPrice: item.total,
        date: sale.dtmDate || new Date().toISOString().split('T')[0],
        concept: `Venta - Factura ${sale.strInvoiceCode}`,
        document: sale.strInvoiceCode || ''
      };
      
      this.kardexService.createMovement(movement).subscribe({
        next: (response) => {
          console.log('Movimiento registrado en kardex:', response);
        },
        error: (error) => {
          console.error('Error registrando movimiento en kardex:', error);
        }
      });
    });
  }
}