import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../shared/services/product.service';
import { ProductFormComponent } from './form/product-form.component';
import { NumberFormatPipe } from '../../shared/pipes/number-format.pipe';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductFormComponent, NumberFormatPipe],
  templateUrl: './products-list.component.html',
  styleUrls: ['./products-list.component.css']
})
export class ProductsListComponent implements OnInit {
  products: any[] = [];
  showModal = false;
  editingProduct: any = null;
  Math = Math;
  loading = false;

  page = 1;
  limit = 10;
  total = 0;

  showFilters = false;
  viewMode: 'table' | 'cards' = 'table';
  searchFilter = '';
  statusFilter = 'all';

  currentImageIndex: Map<string, number> = new Map();
  imageErrors: Set<string> = new Set();
  imageLoaded: Set<string> = new Set();
  imageLoading: Set<string> = new Set();

  private readonly VIEW_MODE_KEY = 'products_view_mode';

  constructor(
    private productService: ProductService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadViewMode();
    this.loadProducts();
  }

  loadViewMode(): void {
    const savedMode = localStorage.getItem(this.VIEW_MODE_KEY);
    if (savedMode === 'table' || savedMode === 'cards') {
      this.viewMode = savedMode;
    }
  }

  setViewMode(mode: 'table' | 'cards'): void {
    this.viewMode = mode;
    localStorage.setItem(this.VIEW_MODE_KEY, mode);
  }

  loadProducts(): void {
    this.loading = true;
    this.imageErrors.clear();
    this.imageLoaded.clear();
    this.imageLoading.clear();
    this.currentImageIndex.clear();
    
    this.productService.getProducts(this.page, this.limit).subscribe({
      next: (response) => {
        this.products = response.data;
        this.total = response.total;
        this.loading = false;
        
        // Inicializar estado de carga para productos con imágenes
        this.products.forEach(product => {
          if (product.images && product.images.length > 0) {
            this.imageLoading.add(product.strId);
          }
        });
        
        console.log('Products loaded:', this.products);
      },
      error: () => {
        Swal.fire('Error', 'No se pudieron cargar los productos', 'error');
        this.loading = false;
      }
    });
  }

  openCreateModal(): void {
    this.showModal = true;
  }

  openEditModal(product: any): void {
    this.editingProduct = product;
    this.showModal = true;
  }

  onProductCreated(): void {
    this.closeModal();
    this.loadProducts();
  }

  deleteProduct(id: string): void {
    Swal.fire({
      title: '¿Está seguro?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.productService.deleteProduct(id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Producto eliminado correctamente', 'success');
            this.loadProducts();
          },
          error: () => {
            Swal.fire('Error', 'No se pudo eliminar el producto', 'error');
          }
        });
      }
    });
  }

  closeModal(): void {
    this.showModal = false;
    this.editingProduct = null;
  }

  nextPage(): void {
    if (this.page * this.limit < this.total) {
      this.page++;
      this.loadProducts();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadProducts();
    }
  }

  clearFilters(): void {
    this.searchFilter = '';
    this.statusFilter = 'all';
  }

  getStockStatusClass(product: any): string {
    const currentStock = parseFloat(product.ingQuantity || 0);
    const minStock = parseFloat(product.ingStockMin || 0);
    return currentStock < minStock ? 'stock-low' : 'stock-normal';
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  getCurrentImageIndex(productId: string): number {
    return this.currentImageIndex.get(productId) || 0;
  }

  nextImage(productId: string, totalImages: number, event: Event): void {
    event.stopPropagation();
    const current = this.getCurrentImageIndex(productId);
    const next = (current + 1) % totalImages;
    this.currentImageIndex.set(productId, next);
  }

  prevImage(productId: string, totalImages: number, event: Event): void {
    event.stopPropagation();
    const current = this.getCurrentImageIndex(productId);
    const prev = current === 0 ? totalImages - 1 : current - 1;
    this.currentImageIndex.set(productId, prev);
  }

  goToKardex(product: any): void {
    this.router.navigate(['/kardex'], {
      queryParams: {
        type: 'product',
        code: product.strCode?.replace('JMY-P-', '')
      }
    });
  }

  setImageIndex(productId: string, index: number, event: Event): void {
    event.stopPropagation();
    this.currentImageIndex.set(productId, index);
  }

  isImageLoading(productId: string): boolean {
    return this.imageLoading.has(productId);
  }

  onImageError(event: any, productId: string): void {
    const imgSrc = event.target?.src || 'unknown';
    console.error('Error loading image for product:', productId, 'URL:', imgSrc);
    this.imageErrors.add(productId);
    this.imageLoading.delete(productId);
  }

  onImageLoad(event: any, productId: string): void {
    const imgSrc = event.target?.src || 'unknown';
    console.log('Image loaded successfully for product:', productId, 'URL:', imgSrc);
    this.imageLoaded.add(productId);
    this.imageLoading.delete(productId);
    this.imageErrors.delete(productId);
  }

  hasImageError(productId: string): boolean {
    return this.imageErrors.has(productId);
  }
}
