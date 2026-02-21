import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-sales-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-list.component.html',
  styleUrls: ['./sales-list.component.css']
})
export class SalesListComponent implements OnInit {
  sales: any[] = [];
  products: any[] = [];
  showModal = false;
  loading = false;

  saleData = {
    productId: '',
    quantity: 0,
    unitPrice: 0,
    customerName: '',
    date: new Date().toISOString().split('T')[0]
  };

  private baseUrl = 'http://localhost:3001/api';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadSales();
    this.loadProducts();
  }

  loadSales(): void {
    this.loading = true;
    this.http.get<any>(`${this.baseUrl}/sales`).subscribe({
      next: (response) => {
        this.sales = response.data || response;
        this.loading = false;
      },
      error: () => {
        this.sales = [];
        this.loading = false;
      }
    });
  }

  loadProducts(): void {
    this.http.get<any>(`${this.baseUrl}/products`).subscribe({
      next: (response) => {
        this.products = response.data || response;
      },
      error: () => {
        this.products = [];
      }
    });
  }

  openModal(): void {
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.resetForm();
  }

  resetForm(): void {
    this.saleData = {
      productId: '',
      quantity: 0,
      unitPrice: 0,
      customerName: '',
      date: new Date().toISOString().split('T')[0]
    };
  }

  onProductChange(): void {
    const product = this.products.find(p => p.strId === this.saleData.productId);
    if (product) {
      this.saleData.unitPrice = parseFloat(product.fltPrice);
    }
  }

  saveSale(): void {
    if (!this.saleData.productId || this.saleData.quantity <= 0) {
      Swal.fire('Error', 'Complete todos los campos requeridos', 'error');
      return;
    }

    this.http.post(`${this.baseUrl}/sales`, this.saleData).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Venta registrada correctamente', 'success');
        this.loadSales();
        this.closeModal();
      },
      error: () => {
        Swal.fire('Error', 'No se pudo registrar la venta', 'error');
      }
    });
  }

  getTotalPrice(sale: any): number {
    return parseFloat(sale.fltQuantity || 0) * parseFloat(sale.fltUnitPrice || 0);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
}
