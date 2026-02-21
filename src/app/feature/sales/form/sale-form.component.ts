import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomersService } from '../../../shared/services/customers.service';
import { ProductsService } from '../../../shared/services/products.service';
import { SalesService, CreateSaleDto } from '../../../shared/services/sales.service';
import { KardexService } from '../../../shared/services/kardex.service';
import { StockService } from '../../../shared/services/stock.service';
import { CompositionService } from '../../../shared/services/composition.service';
import { Customer } from '../../../shared/model/customer.model';

interface OrderItem {
  id: string;
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

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

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
    product: '',
    quantity: 1,
    unitPrice: 0
  };

  customers: Customer[] = [];
  products: Product[] = [];
  filteredCustomers: Customer[] = [];
  filteredProducts: Product[] = [];

  constructor(private customersService: CustomersService, private productsService: ProductsService, private salesService: SalesService, private kardexService: KardexService, private stockService: StockService, private compositionService: CompositionService) {}

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
    this.productsService.getProducts().subscribe({
      next: (response: any) => {
        console.log('Products loaded:', response);
        const products = response.data || response;
        this.products = products.map((product: any) => ({
          id: product.strId,
          name: product.strName,
          price: product.fltPrice,
          stock: product.ingQuantity
        }));
        this.filteredProducts = this.products;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        // Fallback con productos mock
        this.products = [
          { id: '550e8400-e29b-41d4-a716-446655440000', name: 'AREPA CON TODO', price: 17000, stock: 5 },
          { id: '550e8400-e29b-41d4-a716-446655440001', name: 'PATACÓN CON TODO', price: 20000, stock: 3 }
        ];
        this.filteredProducts = this.products;
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

  addItem(): void {
    if (!this.canAddItem()) return;
    
    const item: OrderItem = {
      id: Date.now().toString(),
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
      strProductId: this.getProductIdByName(this.orderData.items[0]?.product || ''),
      dtmDate: new Date().toISOString().split('T')[0],
      fltQuantity: Number(this.orderData.items[0]?.quantity) || 0,
      fltUnitPrice: Number(this.orderData.items[0]?.unitPrice) || 0,
      customerName: this.orderData.customerName,
      items: this.orderData.items,
      subtotal: Number(this.orderData.subtotal),
      tax: Number(this.orderData.tax),
      total: Number(this.orderData.total)
    };
    
    this.salesService.createSale(saleData).subscribe({
      next: (response) => {
        console.log('Sale created:', response);
        
        // Registrar movimientos en kardex
        this.registerKardexMovements(response, this.orderData.items);
        
        this.loading = false;
        this.saleCreated.emit();
        this.resetForm();
      },
      error: (error) => {
        this.loading = false;
        console.error('Error creating sale:', error);
        
        const errorMessage = error.error?.message || 'Error al crear la venta';
        
        if (typeof (window as any).Swal !== 'undefined') {
          if (errorMessage.includes('Stock insuficiente') || errorMessage.includes('insuficiente')) {
            (window as any).Swal.fire({
              icon: 'error',
              title: 'Stock Insuficiente',
              text: 'No hay suficiente stock del producto para realizar esta venta',
              confirmButtonText: 'Entendido'
            });
          } else {
            (window as any).Swal.fire({
              icon: 'error',
              title: 'Error',
              text: errorMessage,
              confirmButtonText: 'Cerrar'
            });
          }
        } else {
          alert(errorMessage);
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

  registerKardexMovements(sale: any, items: OrderItem[]): void {
    items.forEach(item => {
      const productId = this.getProductIdByName(item.product);
      
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