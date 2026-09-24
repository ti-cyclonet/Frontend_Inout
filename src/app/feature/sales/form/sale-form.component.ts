import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomersService } from '../../../shared/services/customers.service';
import { ProductsService, SellableItem } from '../../../shared/services/products.service';
import { SalesService, CreateSaleDto } from '../../../shared/services/sales.service';
import { KardexService } from '../../../shared/services/kardex.service';
import { StockService } from '../../../shared/services/stock.service';
import { StockAlertsService } from '../../../shared/services/stock-alerts.service';
import { CompositionService } from '../../../shared/services/composition.service';
import { Customer } from '../../../shared/model/customer.model';
import Swal from 'sweetalert2';

interface OrderItem {
  id: string;
  productId: string;
  itemType: SellableItem['itemType'];
  product: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface OrderForm {
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
}

type Product = SellableItem;

@Component({
  selector: 'app-sale-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sale-form.component.html',
  styleUrls: ['./sale-form.component.css']
})
export class SaleFormComponent implements OnInit {
  @Input() isModal = false;
  @Output() saleCreated = new EventEmitter<void>();
  @Output() formCancelled = new EventEmitter<void>();
  
  loading = false;
  showCustomerDropdown = false;
  showProductDropdown = false;
  customerSearchTerm = '';
  productSearchTerm = '';
  
  orderData: OrderForm = {
    customerName: '',
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0
  };
  
  currentItem = {
    productId: '',
    product: '',
    quantity: 1,
    unitPrice: 0
  };

  customers: Customer[] = [];
  products: Product[] = [];
  filteredCustomers: Customer[] = [];
  filteredProducts: Product[] = [];

  constructor(private customersService: CustomersService, private productsService: ProductsService, private salesService: SalesService, private kardexService: KardexService, private stockService: StockService, private compositionService: CompositionService, private stockAlertsService: StockAlertsService) {}

  ngOnInit(): void {
    this.loadCustomers();
    this.loadProducts();
  }

  loadCustomers(): void {
    this.customersService.getCustomers().subscribe({
      next: (customers) => {
        this.customers = customers;
        this.filteredCustomers = customers;
      },
      error: (error) => console.error('Error loading customers:', error)
    });
  }

  loadProducts(): void {
    // Productos + materiales de reventa, con stock DISPONIBLE (lo reservado
    // por pedidos confirmados no se puede vender; el backend valida igual).
    this.productsService.getSellableItems().subscribe({
      next: (items) => {
        this.products = items;
        this.filteredProducts = this.products;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.products = [];
        this.filteredProducts = [];
      }
    });
  }

  getCustomerDisplayName(customer: Customer): string {
    if (customer.personType === 'J' && customer.businessName) {
      return customer.businessName;
    }
    
    if (customer.personType === 'N' || !customer.personType) {
      const names = [
        customer.firstName,
        customer.secondName,
        customer.firstSurname,
        customer.secondSurname
      ].filter(name => name && name.trim()).join(' ');
      
      if (names) {
        return names;
      }
    }
    
    return customer.contactPerson || customer.businessName || customer.email || 'Sin nombre';
  }

  filterCustomers(): void {
    const query = this.customerSearchTerm.toLowerCase();
    if (query) {
      this.filteredCustomers = this.customers.filter(customer => {
        const displayName = this.getCustomerDisplayName(customer).toLowerCase();
        return displayName.includes(query) || customer.email?.toLowerCase().includes(query);
      });
    } else {
      this.filteredCustomers = this.customers;
    }
  }

  filterProducts(): void {
    const query = this.productSearchTerm.toLowerCase();
    if (query) {
      this.filteredProducts = this.products.filter(product => 
        product.name.toLowerCase().includes(query)
      );
    } else {
      this.filteredProducts = this.products;
    }
  }

  selectCustomer(customer: Customer): void {
    this.orderData.customerName = this.getCustomerDisplayName(customer);
    this.customerSearchTerm = this.orderData.customerName;
    this.showCustomerDropdown = false;
  }

  selectProduct(product: Product): void {
    if (product.stock <= 0) {
      this.showProductDropdown = false;
      Swal.fire({
        icon: 'warning',
        title: 'Producto sin stock',
        text: `"${product.name}" no tiene stock disponible. No se puede vender.`,
        confirmButtonText: 'Entendido'
      });
      return;
    }
    this.currentItem.productId = product.id;
    this.currentItem.product = product.name;
    this.currentItem.unitPrice = product.price || 0;
    this.productSearchTerm = product.name;
    this.showProductDropdown = false;
  }

  canAddItem(): boolean {
    return !!(this.currentItem.product && 
              this.currentItem.quantity > 0 && 
              this.currentItem.unitPrice > 0);
  }

  /** Unidades de un producto que ya están en el carrito. */
  private quantityInCart(productId: string): number {
    return this.orderData.items
      .filter(i => i.productId === productId)
      .reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  }

  addItem(): void {
    if (!this.canAddItem()) return;

    const product = this.products.find(p => p.id === this.currentItem.productId);
    if (!product) {
      Swal.fire({ icon: 'warning', title: 'Producto no válido', text: 'Selecciona un producto de la lista.', confirmButtonText: 'Entendido' });
      return;
    }
    const inCart = this.quantityInCart(product.id);
    const requested = inCart + Number(this.currentItem.quantity);
    if (requested > product.stock) {
      const remaining = Math.max(0, product.stock - inCart);
      Swal.fire({
        icon: 'error',
        title: 'Stock insuficiente',
        html: `<b>${product.name}</b><br>Disponible: ${product.stock}` +
          (inCart > 0 ? ` (ya tienes ${inCart} en la venta)` : '') +
          `<br>Solo puedes agregar ${remaining} unidad(es) más.`,
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const item: OrderItem = {
      id: Date.now().toString(),
      productId: product.id,
      itemType: product.itemType,
      product: this.currentItem.product,
      quantity: this.currentItem.quantity,
      unitPrice: this.currentItem.unitPrice,
      total: this.currentItem.quantity * this.currentItem.unitPrice
    };
    
    this.orderData.items.push(item);
    this.updateTotals();
    this.resetCurrentItem();
  }

  removeItem(index: number): void {
    this.orderData.items.splice(index, 1);
    this.updateTotals();
  }

  updateTotals(): void {
    this.orderData.subtotal = this.orderData.items.reduce((sum, item) => sum + item.total, 0);
    this.orderData.tax = this.orderData.subtotal * 0.19;
    this.orderData.total = this.orderData.subtotal + this.orderData.tax;
  }

  resetCurrentItem(): void {
    this.currentItem = {
      productId: '',
      product: '',
      quantity: 1,
      unitPrice: 0
    };
  }

  canSubmit(): boolean {
    return !!(this.orderData.customerName && this.orderData.items.length > 0);
  }

  onSubmit(): void {
    if (!this.canSubmit() || this.loading) return;

    this.loading = true;
    
    const saleData: CreateSaleDto = {
      strTenantId: 'default-tenant',
      strProductId: this.orderData.items[0]?.productId,
      dtmDate: new Date().toISOString().split('T')[0],
      fltQuantity: Number(this.orderData.items[0]?.quantity) || 0,
      fltUnitPrice: Number(this.orderData.items[0]?.unitPrice) || 0,
      customerName: this.orderData.customerName,
      // productId por ítem: el backend valida y descuenta stock de TODOS
      items: this.orderData.items.map(i => ({ ...i, productName: i.product })),
      subtotal: Number(this.orderData.subtotal),
      tax: Number(this.orderData.tax),
      total: Number(this.orderData.total)
    };
    
    this.salesService.createSale(saleData).subscribe({
      next: (response) => {
        console.log('Sale created:', response);
        
        // Registrar movimientos en kardex
        this.registerKardexMovements(response, this.orderData.items);

        // La venta descuenta stock del producto: refrescar el badge de
        // alertas (sidebar) y el stock mostrado en el buscador.
        this.stockAlertsService.refreshAlerts();
        this.loadProducts();

        this.loading = false;
        this.saleCreated.emit();
        this.resetForm();
      },
      error: (error) => {
        this.loading = false;
        console.error('Error creating sale:', error);
        
        const errorMessage = error.error?.message || 'Error al crear la venta';

        if (errorMessage.includes('insuficiente')) {
          // El backend lista cada producto sin stock con disponible/solicitado
          Swal.fire({
            icon: 'error',
            title: 'Stock insuficiente',
            text: errorMessage,
            confirmButtonText: 'Entendido'
          });
          this.loadProducts();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: errorMessage,
            confirmButtonText: 'Cerrar'
          });
        }
      }
    });
  }

  onCancel(): void {
    this.resetForm();
    this.formCancelled.emit();
  }

  getProductIdByName(productName: string): string {
    const product = this.products.find(p => p.name === productName);
    // Si no encuentra el producto, generar un UUID válido
    return product?.id || crypto.randomUUID();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  resetForm(): void {
    this.orderData = {
      customerName: '',
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0
    };
    this.resetCurrentItem();
  }

  getTotalQuantity(): number {
    return this.orderData.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  registerKardexMovements(sale: any, items: OrderItem[]): void {
    items.forEach(item => {
      const productId = item.productId;
      
      const movement = {
        entityId: productId,
        entityType: 'product' as const,
        movementType: 'output' as const,
        quantity: item.quantity,
        unitValue: item.unitPrice,
        totalPrice: item.total,
        date: new Date().toISOString().split('T')[0],
        concept: `Venta - Factura ${sale.strInvoiceCode || sale.strId}`,
        document: sale.strInvoiceCode || sale.strId || ''
      };
      
      this.kardexService.createMovement(movement).subscribe({
        next: (response) => {
          console.log('Movimiento registrado en kardex:', response);
        },
        error: (error) => {
          console.error('Error registrando movimiento en kardex:', error);
        }
      });
      
      // Actualizar stock local del producto
      const product = this.products.find(p => p.id === productId);
      if (product) {
        product.stock = Math.max(0, product.stock - item.quantity);
      }
    });
  }
}