import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomersService } from '../../../shared/services/customers.service';
import { ProductsService } from '../../../shared/services/products.service';
import { Customer } from '../../../shared/model/customer.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderForm {
  customerId: string;
  customerName: string;
  items: OrderItem[];
  notes: string;
  deliveryDate: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-form.component.html',
  styleUrls: ['./order-form.component.css']
})
export class OrderFormComponent implements OnInit {
  @Input() isModal = false;
  @Output() orderCreated = new EventEmitter<void>();
  @Output() formCancelled = new EventEmitter<void>();

  loading = false;
  showCustomerDropdown = false;
  showProductDropdown = false;
  customerSearchTerm = '';
  productSearchTerm = '';

  orderData: OrderForm = {
    customerId: '',
    customerName: '',
    items: [],
    notes: '',
    deliveryDate: '',
    subtotal: 0,
    tax: 0,
    discount: 0,
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

  private baseUrl = `${environment.apiUrl}/orders`;

  constructor(
    private customersService: CustomersService,
    private productsService: ProductsService,
    private http: HttpClient
  ) {}

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
      if (names) return names;
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
    this.orderData.customerId = customer.id || '';
    this.orderData.customerName = this.getCustomerDisplayName(customer);
    this.customerSearchTerm = this.orderData.customerName;
    this.showCustomerDropdown = false;
  }

  selectProduct(product: Product): void {
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

  addItem(): void {
    if (!this.canAddItem()) return;

    const item: OrderItem = {
      productId: this.currentItem.productId,
      productName: this.currentItem.product,
      quantity: this.currentItem.quantity,
      unitPrice: this.currentItem.unitPrice,
      subtotal: this.currentItem.quantity * this.currentItem.unitPrice
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
    this.orderData.subtotal = this.orderData.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.orderData.tax = this.orderData.subtotal * 0.19;
    this.orderData.discount = 0;
    this.orderData.total = this.orderData.subtotal + this.orderData.tax - this.orderData.discount;
  }

  resetCurrentItem(): void {
    this.currentItem = { productId: '', product: '', quantity: 1, unitPrice: 0 };
    this.productSearchTerm = '';
  }

  canSubmit(): boolean {
    return !!(this.orderData.customerName && this.orderData.items.length > 0);
  }

  onSubmit(): void {
    if (!this.canSubmit() || this.loading) return;

    this.loading = true;

    const payload = {
      customerId: this.orderData.customerId || null,
      customerName: this.orderData.customerName,
      items: this.orderData.items,
      notes: this.orderData.notes || null,
      deliveryDate: this.orderData.deliveryDate || null,
      subtotal: this.orderData.subtotal,
      tax: this.orderData.tax,
      discount: this.orderData.discount,
      total: this.orderData.total
    };

    this.http.post(this.baseUrl, payload).subscribe({
      next: () => {
        this.loading = false;
        this.orderCreated.emit();
        this.resetForm();
      },
      error: (error) => {
        this.loading = false;
        console.error('Error creating order:', error);
        const errorMessage = error.error?.message || 'Error al crear el pedido';
        alert(errorMessage);
      }
    });
  }

  onCancel(): void {
    this.resetForm();
    this.formCancelled.emit();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  resetForm(): void {
    this.orderData = {
      customerId: '',
      customerName: '',
      items: [],
      notes: '',
      deliveryDate: '',
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0
    };
    this.customerSearchTerm = '';
    this.resetCurrentItem();
  }
}
