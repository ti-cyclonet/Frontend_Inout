import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

interface Product {
  strId: string;
  strName: string;
  strDescription: string;
  fltPrice: number;
  strLocation: string;
  intCategoryId: number;
  strStatus: string;
  views?: number;
  sales?: number;
  rating?: number;
  image?: string;
}

interface MarketStats {
  totalProducts: number;
  totalViews: number;
  totalSales: number;
  mostViewedProduct: Product | null;
  mostSoldProduct: Product | null;
  topRatedProduct: Product | null;
}

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './marketplace.component.html',
  styleUrls: ['./marketplace.component.css']
})
export class MarketplaceComponent implements OnInit, OnDestroy {
  tenantId: string = '';
  businessName: string = '';
  businessSector: string = 'general';
  isAdminMode: boolean = false;
  selectedProductIds: Set<string> = new Set();
  products: Product[] = [];
  filteredProducts: Product[] = [];
  productGroups: any[] = [];
  featuredProducts: Product[] = [];
  infiniteFeaturedProducts: Product[] = [];
  featuredTransform = 0;
  private featuredInterval: any;
  stats: MarketStats = {
    totalProducts: 0,
    totalViews: 0,
    totalSales: 0,
    mostViewedProduct: null,
    mostSoldProduct: null,
    topRatedProduct: null
  };
  
  searchTerm: string = '';
  selectedCategory: string = 'all';
  sortBy: string = 'name';
  loading = true;
  imageErrors: Set<string> = new Set();
  carouselProducts: Product[] = [];
  currentSlide = 0;
  private carouselInterval: any;
  selectedProduct: Product | null = null;
  providerInfo: any = null;
  
  private baseUrl = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private titleService: Title
  ) {}

  ngOnInit(): void {
    // Cambiar título del tab solo para marketplace
    this.titleService.setTitle('CM CycloNet Market');
    
    this.route.params.subscribe(params => {
      this.tenantId = params['tenantId'] || 'current-tenant';
      this.loadMarketplaceData();
    });
    
    // Verificar si viene desde el dashboard (modo admin)
    this.route.queryParams.subscribe(queryParams => {
      this.isAdminMode = queryParams['admin'] === 'true';
      if (this.isAdminMode) {
        this.checkAuthentication();
      }
    });
  }

  loadMarketplaceData(): void {
    // Para ruta pública general, cargar todos los productos
    if (this.tenantId === 'home') {
      this.loadAllProducts();
      return;
    }
    
    // Para ruta pública, cargar datos del tenant específico
    if (this.tenantId && this.tenantId !== 'current-tenant') {
      this.loadTenantData(this.tenantId);
      return;
    }
    
    // Para ruta privada, cargar datos reales
    Promise.all([
      this.http.get<any>(`${this.baseUrl}/products`).toPromise(),
      this.http.get<any>(`${this.baseUrl}/sales`).toPromise()
    ]).then(([productsResponse, salesResponse]) => {
      this.products = (productsResponse.data || []).map((product: any) => ({
        ...product,
        views: Math.floor(Math.random() * 500) + 50,
        sales: Math.floor(Math.random() * 100) + 10,
        rating: Math.round((Math.random() * 2 + 3) * 10) / 10,
        image: product.images && product.images.length > 0 ? product.images[0].strImageUrl : null
      }));
      
      this.calculateStats();
      this.filteredProducts = [...this.products];
      this.loading = false;
    }).catch(() => {
      this.loadExampleData();
    });
  }

  loadAllProducts(): void {
    // Cargar configuraciones de marketplace de todos los tenants
    this.http.get<any[]>(`${this.baseUrl}/marketplace-config`).toPromise()
      .then((configs) => {
        if (!configs || configs.length === 0) {
          this.products = [];
          this.filteredProducts = [];
          this.loading = false;
          return;
        }
        
        // Obtener todos los IDs de productos seleccionados
        const allSelectedIds = new Set<string>();
        configs.forEach(config => {
          const ids = typeof config.selectedProductIds === 'string' 
            ? JSON.parse(config.selectedProductIds) 
            : config.selectedProductIds;
          if (Array.isArray(ids)) {
            ids.forEach((id: string) => allSelectedIds.add(id));
          }
        });
        
        if (allSelectedIds.size === 0) {
          this.products = [];
          this.filteredProducts = [];
          this.loading = false;
          return;
        }
        
        // Cargar todos los productos y filtrar solo los seleccionados
        this.http.get<any>(`${this.baseUrl}/products/all`).toPromise()
          .then((productsResponse) => {
            this.products = (productsResponse.data || [])
              .filter((product: any) => allSelectedIds.has(product.strId))
              .map((product: any) => ({
                ...product,
                views: Math.floor(Math.random() * 500) + 50,
                sales: Math.floor(Math.random() * 100) + 10,
                rating: Math.round((Math.random() * 2 + 3) * 10) / 10,
                image: product.images && product.images.length > 0 ? product.images[0].strImageUrl : null
              })).sort(() => Math.random() - 0.5);
            
            this.calculateStats();
            this.filteredProducts = [...this.products];
            this.createProductGroups();
            this.createFeaturedProducts();
            this.setupCarousel();
            this.loading = false;
          })
          .catch(() => {
            this.products = [];
            this.filteredProducts = [];
            this.loading = false;
          });
      })
      .catch(() => {
        this.products = [];
        this.filteredProducts = [];
        this.loading = false;
      });
  }

  loadTenantData(tenantId: string): void {
    Promise.all([
      this.http.get<any>(`${this.baseUrl}/products/tenant/${tenantId}`).toPromise(),
      this.http.get<any>(`${environment.auth.authorizaUrl}/contracts/tenant/${tenantId}`).toPromise().catch(() => ({ businessSector: 'general' })),
      this.http.get<any>(`${this.baseUrl}/marketplace-config/${tenantId}`).toPromise().catch(() => null)
    ]).then(([productsResponse, contractResponse, configResponse]) => {
      this.products = (productsResponse.data || []).map((product: any) => ({
        ...product,
        views: Math.floor(Math.random() * 500) + 50,
        sales: Math.floor(Math.random() * 100) + 10,
        rating: Math.round((Math.random() * 2 + 3) * 10) / 10,
        image: product.images && product.images.length > 0 ? product.images[0].strImageUrl : null
      }));
      
      // Cargar configuración guardada si existe
      if (configResponse && configResponse.selectedProductIds) {
        this.selectedProductIds = new Set(configResponse.selectedProductIds);
        // Solo filtrar productos en modo público, no en modo admin
        if (!this.isAdminMode) {
          this.products = this.products.filter(product => 
            this.selectedProductIds.has(product.strId)
          );
        }
      }
      
      // Obtener nombre del negocio y sector
      const businessSector = contractResponse?.businessSector || 'general';
      this.businessSector = businessSector;
      this.businessName = contractResponse?.user?.basicData?.legalEntityData?.businessName || 
                          contractResponse?.user?.basicData?.naturalPersonData?.strFirstName || '';
      
      this.customizeMarketplaceBySector(businessSector);
      
      this.calculateStats();
      this.filteredProducts = [...this.products];
      this.createProductGroups();
      this.createFeaturedProducts();
      this.setupCarousel();
      this.loading = false;
    })
    .catch(() => {
      this.loadExampleData();
    });
  }

  loadExampleData(): void {
    // Datos de ejemplo para la vista pública
    this.products = [
      {
        strId: '1',
        strName: 'PATACÓN RELLENO DE CARNE DESMECHADA',
        strDescription: 'Crocante patacón de plátano verde servido con carne desmechada jugosa, gratinado con queso mozzarella y terminado con un toque de cilantro y salsa rosada.',
        fltPrice: 16000,
        strLocation: 'Sitio Principal',
        intCategoryId: 23,
        strStatus: 'active',
        views: 245,
        sales: 67,
        rating: 4.8,
        image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
      },
      {
        strId: '2',
        strName: 'AREPA ASADA RELLENA CON CARNE DESMECHADA',
        strDescription: 'Deliciosa arepa asada rellena con carne desmechada jugosa, acompañada de queso rallado y salsa de ajo.',
        fltPrice: 12000,
        strLocation: 'Sitio Principal',
        intCategoryId: 23,
        strStatus: 'active',
        views: 189,
        sales: 43,
        rating: 5.0,
        image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
      },
      {
        strId: '3',
        strName: 'TALADRO INALÁMBRICO 18V',
        strDescription: 'Taladro inalámbrico profesional de 18V con batería de larga duración. Ideal para trabajos de construcción.',
        fltPrice: 180000,
        strLocation: 'Ferretería Norte',
        intCategoryId: 25,
        strStatus: 'active',
        views: 156,
        sales: 89,
        rating: 4.3,
        image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=300&fit=crop'
      },
      {
        strId: '4',
        strName: 'CAMISETA POLO PREMIUM',
        strDescription: 'Camiseta polo de algodón 100% premium, disponible en varios colores. Perfecta para uso casual o formal.',
        fltPrice: 45000,
        strLocation: 'Tienda Centro',
        intCategoryId: 24,
        strStatus: 'active',
        views: 189,
        sales: 43,
        rating: 4.5,
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=300&fit=crop'
      },
      {
        strId: '5',
        strName: 'LÁMPARA DECORATIVA LED',
        strDescription: 'Elegante lámpara decorativa con tecnología LED, perfecta para crear ambientes acogedores en el hogar.',
        fltPrice: 85000,
        strLocation: 'Hogar & Estilo',
        intCategoryId: 26,
        strStatus: 'active',
        views: 134,
        sales: 56,
        rating: 4.6,
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop'
      },
      {
        strId: '6',
        strName: 'ZAPATILLAS DEPORTIVAS',
        strDescription: 'Zapatillas deportivas de alta calidad para running y entrenamiento. Tecnología de amortiguación avanzada.',
        fltPrice: 120000,
        strLocation: 'Deportes Pro',
        intCategoryId: 27,
        strStatus: 'active',
        views: 98,
        sales: 34,
        rating: 4.9,
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop'
      },
      {
        strId: '7',
        strName: 'CONSULTORÍA EMPRESARIAL',
        strDescription: 'Servicio de consultoría empresarial especializada en optimización de procesos y estrategia de negocio.',
        fltPrice: 250000,
        strLocation: 'Servicios Pro',
        intCategoryId: 28,
        strStatus: 'active',
        views: 312,
        sales: 78,
        rating: 4.7,
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop'
      },
      {
        strId: '7',
        strName: 'HAMBURGUESA ARTESANAL',
        strDescription: 'Hamburguesa gourmet con carne 100% res, queso cheddar, lechuga, tomate y salsa especial de la casa.',
        fltPrice: 15000,
        strLocation: 'Sitio 3',
        intCategoryId: 23,
        strStatus: 'active',
        views: 278,
        sales: 92,
        rating: 4.4,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop'
      },
      {
        strId: '8',
        strName: 'PIZZA MARGHERITA',
        strDescription: 'Pizza clásica italiana con salsa de tomate, mozzarella fresca, albahaca y aceite de oliva extra virgen.',
        fltPrice: 22000,
        strLocation: 'Sitio 2',
        intCategoryId: 23,
        strStatus: 'active',
        views: 445,
        sales: 156,
        rating: 4.8,
        image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop'
      },
      {
        strId: '9',
        strName: 'SMOOTHIE TROPICAL',
        strDescription: 'Batido refrescante con mango, piña, maracuyá y un toque de coco. Rico en vitaminas y antioxidantes.',
        fltPrice: 6500,
        strLocation: 'Sitio 1',
        intCategoryId: 24,
        strStatus: 'active',
        views: 167,
        sales: 73,
        rating: 4.5,
        image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=400&h=300&fit=crop'
      },
      {
        strId: '10',
        strName: 'TACOS MEXICANOS',
        strDescription: 'Auténticos tacos con tortilla de maíz, carne al pastor, cebolla, cilantro y salsa verde picante.',
        fltPrice: 13500,
        strLocation: 'Sitio 3',
        intCategoryId: 23,
        strStatus: 'active',
        views: 203,
        sales: 85,
        rating: 4.6,
        image: 'https://images.unsplash.com/photo-1565299585323-38174c4a6c18?w=400&h=300&fit=crop'
      },
      {
        strId: '11',
        strName: 'CAFÉ COLOMBIANO PREMIUM',
        strDescription: 'Café 100% colombiano de origen único, tostado artesanalmente. Notas de chocolate y caramelo.',
        fltPrice: 5500,
        strLocation: 'Sitio 1',
        intCategoryId: 24,
        strStatus: 'active',
        views: 189,
        sales: 124,
        rating: 4.9,
        image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop'
      },
      {
        strId: '12',
        strName: 'CHEESECAKE DE FRUTOS ROJOS',
        strDescription: 'Delicioso cheesecake cremoso con base de galleta y cobertura de frutos rojos frescos.',
        fltPrice: 9500,
        strLocation: 'Sitio 2',
        intCategoryId: 25,
        strStatus: 'active',
        views: 145,
        sales: 67,
        rating: 4.7,
        image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&h=300&fit=crop'
      }
    ];
    
    this.calculateStats();
    this.filteredProducts = [...this.products];
    this.createProductGroups();
    this.createFeaturedProducts();
    this.setupCarousel();
    this.loading = false;
  }

  calculateStats(): void {
    this.stats.totalProducts = this.products.length;
    this.stats.totalViews = this.products.reduce((sum, p) => sum + (p.views || 0), 0);
    this.stats.totalSales = this.products.reduce((sum, p) => sum + (p.sales || 0), 0);
    
    this.stats.mostViewedProduct = this.products.reduce((max, p) => 
      (p.views || 0) > (max?.views || 0) ? p : max, this.products[0] || null);
    
    this.stats.mostSoldProduct = this.products.reduce((max, p) => 
      (p.sales || 0) > (max?.sales || 0) ? p : max, this.products[0] || null);
    
    this.stats.topRatedProduct = this.products.reduce((max, p) => 
      (p.rating || 0) > (max?.rating || 0) ? p : max, this.products[0] || null);
  }

  onSearch(): void {
    this.filterProducts();
  }

  onCategoryChange(): void {
    this.filterProducts();
  }

  onSortChange(): void {
    this.sortProducts();
  }

  filterProducts(): void {
    this.filteredProducts = this.products.filter(product => {
      const matchesSearch = product.strName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                           product.strDescription.toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchesCategory = this.selectedCategory === 'all' || 
                             product.intCategoryId.toString() === this.selectedCategory;
      return matchesSearch && matchesCategory;
    });
    this.sortProducts();
  }

  sortProducts(): void {
    this.filteredProducts.sort((a, b) => {
      switch (this.sortBy) {
        case 'price-low':
          return parseFloat(a.fltPrice.toString()) - parseFloat(b.fltPrice.toString());
        case 'price-high':
          return parseFloat(b.fltPrice.toString()) - parseFloat(a.fltPrice.toString());
        case 'views':
          return (b.views || 0) - (a.views || 0);
        case 'sales':
          return (b.sales || 0) - (a.sales || 0);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        default:
          return a.strName.localeCompare(b.strName);
      }
    });
  }

  formatCurrency(value: number): string {
    return '$' + new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-CO').format(value);
  }

  getStarRating(rating: number): string[] {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push('full');
    }
    if (hasHalfStar) {
      stars.push('half');
    }
    while (stars.length < 5) {
      stars.push('empty');
    }
    return stars;
  }

  onImageError(event: any, product: Product): void {
    this.imageErrors.add(product.strId);
  }

  hasImageError(productId: string): boolean {
    return this.imageErrors.has(productId);
  }

  setupCarousel(): void {
    // Filtrar productos según configuración guardada
    let productsToUse = this.products;
    if (this.selectedProductIds.size > 0) {
      productsToUse = this.products.filter(p => this.selectedProductIds.has(p.strId));
    } else if (this.selectedProductIds.size === 0 && this.tenantId !== 'home') {
      // Si no hay productos seleccionados, no mostrar ninguno
      productsToUse = [];
    }
    
    this.carouselProducts = this.getRandomProducts(4, productsToUse);
    if (this.carouselProducts.length > 0) {
      this.startCarousel();
      this.startCarouselRotation();
    }
  }

  getRandomProducts(count: number, products: Product[] = this.products): Product[] {
    const productsWithImages = products.filter(p => p.image);
    const shuffled = [...productsWithImages].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  startCarouselRotation(): void {
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.carouselProducts = this.getRandomProducts(4);
        this.currentSlide = 0;
      }, 30000); // 30 segundos - configurable más adelante
    }
  }

  startCarousel(): void {
    if (typeof window !== 'undefined') {
      this.carouselInterval = setInterval(() => {
        this.currentSlide = (this.currentSlide + 1) % this.carouselProducts.length;
      }, 3000);
    }
  }

  ngOnDestroy(): void {
    // Restaurar título original al salir del marketplace
    this.titleService.setTitle('InOut');
    
    if (this.carouselInterval && typeof window !== 'undefined') {
      clearInterval(this.carouselInterval);
    }
    if (this.featuredInterval && typeof window !== 'undefined') {
      clearInterval(this.featuredInterval);
    }
  }

  getCardClass(index: number): string {
    const patterns = ['card-standard', 'card-wide', 'card-compact', 'card-featured'];
    return patterns[index % patterns.length];
  }

  isCompactCard(index: number): boolean {
    return index % 4 === 2;
  }

  createProductGroups(): void {
    const groups = [
      { title: '🍽️ Alimentos y Bebidas', category: 23, icon: '🍽️' },
      { title: '👕 Moda y Estilo', category: 24, icon: '👕' },
      { title: '🔨 Herramientas', category: 25, icon: '🔨' },
      { title: '🏠 Hogar y Decoración', category: 26, icon: '🏠' }
    ];

    this.productGroups = groups.map(group => ({
      title: group.title,
      products: this.filteredProducts.filter(p => p.intCategoryId === group.category).slice(0, 6)
    })).filter(group => group.products.length > 0);

    // Si no hay productos por categoría, mostrar todos los productos sin agrupar
    if (this.productGroups.length === 0) {
      this.productGroups = [
        { title: '📦 Todos los Productos', products: this.filteredProducts }
      ];
    }
  }

  createFeaturedProducts(): void {
    // Filtrar productos según configuración guardada
    let productsToUse = this.products;
    if (this.selectedProductIds.size > 0) {
      productsToUse = this.products.filter(p => this.selectedProductIds.has(p.strId));
    } else if (this.selectedProductIds.size === 0 && this.tenantId !== 'home') {
      productsToUse = [];
    }
    
    this.featuredProducts = productsToUse.filter(p => p.rating && p.rating >= 4.5).slice(0, 10);
    if (this.featuredProducts.length === 0) {
      this.featuredProducts = productsToUse.slice(0, 10);
    }
    this.infiniteFeaturedProducts = [...this.featuredProducts, ...this.featuredProducts];
    this.startFeaturedCarousel();
  }

  startFeaturedCarousel(): void {
    if (typeof window !== 'undefined' && this.featuredProducts.length > 0) {
      this.featuredInterval = setInterval(() => {
        this.featuredTransform -= 1;
        // Reset cuando una tarjeta completa haya pasado
        if (Math.abs(this.featuredTransform) >= this.featuredProducts.length * 200) {
          this.featuredTransform = 0;
        }
      }, 50);
    }
  }

  customizeMarketplaceBySector(sector: string): void {
    if (sector !== 'general') {
      this.selectedCategory = this.getSectorCategory(sector);
      this.filterProducts();
    }
  }

  toggleProductSelection(productId: string): void {
    if (this.selectedProductIds.has(productId)) {
      this.selectedProductIds.delete(productId);
    } else {
      this.selectedProductIds.add(productId);
    }
  }

  isProductSelected(productId: string): boolean {
    return this.selectedProductIds.has(productId);
  }

  saveSelectedProducts(): void {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return;
    }
    
    const selectedProducts = this.filteredProducts.filter(p => 
      this.selectedProductIds.has(p.strId)
    );
    
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Sesión Expirada',
        text: 'Por favor, inicia sesión nuevamente.',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    
    const payload = {
      tenantId: this.tenantId,
      selectedProductIds: Array.from(this.selectedProductIds)
    };
    
    this.http.post(`${this.baseUrl}/marketplace-config`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response) => {
        Swal.fire({
          icon: 'success',
          title: 'Configuración Guardada',
          text: `Se han seleccionado ${selectedProducts.length} productos para mostrar en el marketplace`,
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          window.location.reload();
        });
      },
      error: (error) => {
        console.error('Error al guardar configuración:', error);
        if (error.status === 401) {
          Swal.fire({
            icon: 'error',
            title: 'Sesión Expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonText: 'Entendido'
          }).then(() => {
            localStorage.removeItem('token');
            this.isAdminMode = false;
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al guardar la configuración',
            confirmButtonText: 'Entendido'
          });
        }
      }
    });
  }

  selectAllProducts(): void {
    this.filteredProducts.forEach(product => {
      this.selectedProductIds.add(product.strId);
    });
  }

  clearAllProducts(): void {
    this.selectedProductIds.clear();
  }

  private checkAuthentication(): void {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return;
    }
    
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) {
      Swal.fire({
        icon: 'error',
        title: 'Acceso Denegado',
        text: 'Debes iniciar sesión para acceder al modo administrador.',
        confirmButtonText: 'Entendido'
      }).then(() => {
        this.isAdminMode = false;
        window.location.href = `/marketplace/${this.tenantId}`;
      });
      return;
    }
    
    // Verificar que el token sea válido
    this.http.get(`${this.baseUrl}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response: any) => {
        // Si el usuario está autenticado pero está en el tenantId incorrecto, redirigir a su tenant
        if (response.tenantId !== this.tenantId) {
          window.location.href = `/marketplace/${response.tenantId}?admin=true`;
          return;
        }
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Sesión Expirada',
          text: 'Por favor, inicia sesión nuevamente.',
          confirmButtonText: 'Entendido'
        }).then(() => {
          localStorage.removeItem('token');
          this.isAdminMode = false;
          window.location.href = `/marketplace/${this.tenantId}`;
        });
      }
    });
  }

  getSectorCategory(sector: string): string {
    const sectorCategoryMap: { [key: string]: string } = {
      'restaurant': '23', // Alimentos y Restaurantes
      'fashion': '24',    // Moda y Belleza
      'hardware': '25',   // Ferretería y Electrónicos
      'beauty': '24',     // Moda y Belleza
      'electronics': '25', // Ferretería y Electrónicos
      'automotive': '27',  // Deportes y Automotriz
      'health': '26',     // Hogar y Salud
      'sports': '27',     // Deportes y Automotriz
      'home': '26',       // Hogar y Salud
      'services': '28',   // Servicios
      'retail': 'all'     // Tienda de barrio (todos)
    };
    return sectorCategoryMap[sector] || 'all';
  }

  getVisibleCategories(): Array<{value: string, label: string}> {
    const allCategories = [
      { value: 'all', label: 'Todas las categorías' },
      { value: '23', label: 'Alimentos y Restaurantes' },
      { value: '24', label: 'Moda y Belleza' },
      { value: '25', label: 'Ferretería y Electrónicos' },
      { value: '26', label: 'Hogar y Salud' },
      { value: '27', label: 'Deportes y Automotriz' },
      { value: '28', label: 'Servicios' }
    ];

    // Si es sector general o home, mostrar todas las categorías
    if (this.businessSector === 'general' || this.tenantId === 'home') {
      return allCategories;
    }

    // Para sectores específicos, mostrar solo "Todas las categorías" y la categoría del sector
    const sectorCategory = this.getSectorCategory(this.businessSector);
    if (sectorCategory === 'all') {
      return [allCategories[0]]; // Solo "Todas las categorías"
    }

    const categoryMap: { [key: string]: string } = {
      '23': 'Alimentos y Restaurantes',
      '24': 'Moda y Belleza', 
      '25': 'Ferretería y Electrónicos',
      '26': 'Hogar y Salud',
      '27': 'Deportes y Automotriz',
      '28': 'Servicios'
    };

    return [
      allCategories[0], // "Todas las categorías"
      { value: sectorCategory, label: categoryMap[sectorCategory] || 'Otros' }
    ].filter(Boolean);
  }

  openProductDetails(product: Product): void {
    this.selectedProduct = product;
    this.loadProviderInfo(product);
  }

  closeProductDetails(): void {
    this.selectedProduct = null;
    this.providerInfo = null;
  }

  loadProviderInfo(product: Product): void {
    const tenantId = (product as any).strTenantId;
    if (!tenantId) {
      this.providerInfo = {
        businessName: 'Proveedor',
        sector: 'General',
        email: 'contacto@proveedor.com',
        phone: '3001234567',
        address: 'Dirección no disponible'
      };
      return;
    }

    this.http.get<any>(`${environment.auth.authorizaUrl}/contracts/tenant/${tenantId}`).toPromise()
      .then((contract) => {
        this.providerInfo = {
          businessName: contract?.user?.basicData?.legalEntityData?.businessName || 
                       contract?.user?.basicData?.naturalPersonData?.strFirstName || 'Proveedor',
          sector: contract?.businessSector || 'General',
          email: contract?.user?.basicData?.strEmail || 'contacto@proveedor.com',
          phone: contract?.user?.basicData?.strPhoneNumber || '3001234567',
          address: contract?.user?.basicData?.legalEntityData?.strAddress || 
                  contract?.user?.basicData?.naturalPersonData?.strAddress || 'Dirección no disponible'
        };
      })
      .catch(() => {
        this.providerInfo = {
          businessName: 'Proveedor',
          sector: 'General',
          email: 'contacto@proveedor.com',
          phone: '3001234567',
          address: 'Dirección no disponible'
        };
      });
  }
}