import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';
import { LEGAL_VERSIONS, LegalDocKey, LegalDocument, buildLegalDocument } from './legal/marketplace-legal';
import { decodeJwtPayload } from '../../shared/utils/jwt.util';

import { PaymentVoucherUploadComponent } from './order-tracking/payment-voucher-upload.component';
import { MarketplaceSalesSettingsComponent } from './sales-settings/marketplace-sales-settings.component';
import { PAYMENT_PLAN_LABELS, formatScheduleRange, planLabel } from './order-tracking/order-labels';
import { formatCop } from '../../shared/utils/currency.util';
import { MENU_VARIANTS, MenuBoardComponent, isMenuMode } from './menu-board/menu-board.component';
import { TenantBrandingService } from '../../shared/services/tenant-branding.service';

/** Forma de pago ofrecida en el checkout (ver Backend orders/payment-plans.ts). */
interface PlanChoice {
  plan: string;
  label: string;
  detail: string;
  disabled: boolean;
  note?: string;
}

interface Product {
  strId: string;
  strName: string;
  strDescription: string;
  fltPrice: number;
  strLocation: string;
  intCategoryId: number;
  strStatus: string;
  /** 'product', material de reventa ('material' | 'material_t', por presentación), kit armado o combo. */
  itemType?: 'product' | 'material' | 'material_t' | 'kit' | 'combo';
  /** Precio normal cuando hay promoción vigente (fltPrice ya trae el precio con promoción). */
  listPrice?: number;
  /** Etiqueta de la promoción ("-20%", "-$3.000") o del ahorro del combo. */
  promoLabel?: string;
  promoName?: string;
  /** Combo/kit: lo que incluye. */
  comboIncludes?: string[];
  ingQuantity?: number;
  ingReservedStock?: number;
  /** Se fabrica bajo pedido: se puede pedir sin stock. */
  blnMadeToOrder?: boolean;
  intProductionLeadHours?: number | null;
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
  imports: [CommonModule, RouterLink, FormsModule, PaymentVoucherUploadComponent, MarketplaceSalesSettingsComponent, MenuBoardComponent],
  templateUrl: './marketplace.component.html',
  styleUrls: ['./marketplace.component.css', './marketplace-checkout.css']
})
export class MarketplaceComponent implements OnInit, OnDestroy {
  /** Tema visual por sector: los estilos leen :host([data-sector="…"]). En
   * el host (no en un div interno) para que los modales también lo hereden. */
  @HostBinding('attr.data-sector') get sectorAttr(): string {
    return this.businessSector || 'general';
  }
  tenantId: string = '';
  businessName: string = '';
  /** Logo de la tienda (Configuración > Identidad del negocio). */
  storeLogoUrl: string | null = null;
  businessSector: string = 'general';

  // Banner promocional por tipo de negocio (título, subtítulo y emoji).
  private readonly sectorBanners: Record<string, { title: string; subtitle: string; emoji: string }> = {
    restaurant:   { title: '¡Antojos que llegan a tu mesa!',       subtitle: 'Pide tus platos favoritos y recíbelos calientes.', emoji: '🍽️' },
    fashion:      { title: 'Renueva tu estilo',                    subtitle: 'Las últimas tendencias en moda, a un clic.',      emoji: '👗' },
    hardware:     { title: 'Todo para tu proyecto',                subtitle: 'Herramientas y materiales al mejor precio.',      emoji: '🔧' },
    beauty:       { title: 'Realza tu belleza',                    subtitle: 'Productos de cuidado personal y cosmética.',      emoji: '💄' },
    electronics:  { title: 'Tecnología a tu alcance',              subtitle: 'Lo último en electrónica y gadgets.',            emoji: '📱' },
    automotive:   { title: 'Tu vehículo en las mejores manos',     subtitle: 'Repuestos y accesorios para tu auto.',           emoji: '🚗' },
    health:       { title: 'Cuida tu salud',                       subtitle: 'Productos y suministros para tu bienestar.',     emoji: '💊' },
    sports:       { title: 'Da lo mejor de ti',                    subtitle: 'Equípate para tu deporte favorito.',            emoji: '⚽' },
    home:         { title: 'Tu hogar como lo soñaste',             subtitle: 'Todo para decorar y equipar tu casa.',           emoji: '🏠' },
    services:     { title: 'Servicios a tu medida',                subtitle: 'Soluciones profesionales para lo que necesites.', emoji: '💼' },
    retail:       { title: 'Tu tienda de barrio, en línea',        subtitle: 'Lo que necesitas, cerca de ti.',                 emoji: '🛒' },
    manufacturing:{ title: 'Fabricación a la medida',              subtitle: 'Productos hechos según tu pedido.',              emoji: '🏭' },
    general:      { title: 'Compra fácil y seguro',                subtitle: 'Descubre nuestros productos y recíbelos donde estés.', emoji: '🛍️' },
  };

  /** Datos del banner promocional según el sector del negocio. */
  get sectorBanner(): { title: string; subtitle: string; emoji: string } {
    return this.sectorBanners[this.businessSector] || this.sectorBanners['general'];
  }
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
  
  // Slug editor
  marketplaceSlug: string = '';
  /** Secciones plegables del modo administrador (cerradas por defecto). */
  adminOpen = { url: false, display: false };
  // Slug realmente persistido (para mostrar la URL pública ya guardada).
  savedSlug: string = '';
  slugCopied = false;
  /** QR (PNG en data URL) de la URL pública de la tienda. */
  storeQrDataUrl = '';
  qrCopied = false;
  qrCopyError = '';
  slugSaving = false;
  slugError = '';
  slugSuccess = '';

  // Display mode: 'grid' (tarjetas) o un diseño de menú de restaurante
  // ('menu' Póster, 'menu-chalk' Pizarra, 'menu-clean' Elegante)
  displayMode: string = 'grid';
  readonly menuVariants = MENU_VARIANTS;
  private previewMode: string | null = null;
  /** WhatsApp y mensaje de bienvenida de la tienda (se muestran en el menú). */
  storeWhatsapp = '';
  storeWelcome = '';
  /** Cantidades del carrito por producto (misma referencia mientras no cambie). */
  menuQuantities: Record<string, number> = {};
  private menuQtyKey = '';
  readonly menuTagFor = (p: Product) => this.stockTag(p);

  // Cart
  cart: { product: Product; quantity: number }[] = [];
  showCheckout = false;
  checkoutData = { customerName: '', customerPhone: '', customerAddress: '', customerEmail: '', notes: '' };
  checkoutSending = false;
  orderSuccess: any = null;

  // Sesión opcional de cliente (rol clienteInout) en ESTE marketplace. No es
  // obligatoria: el checkout de invitado (arriba) sigue funcionando igual.
  // Se guarda en una clave de sessionStorage propia (no "authToken", esa es
  // la del staff) para no chocar con una sesión de administrador abierta en
  // el mismo navegador.
  clientLoginData = { email: '', password: '' };
  clientLoggedIn = false;
  clientEmail = '';
  private clientToken: string | null = null;
  private get clientTokenKey(): string {
    return `marketplace_client_token_${this.tenantId}`;
  }

  // Cuenta de cliente en el checkout: invitado (default), iniciar sesión o
  // crear cuenta. El correo SIEMPRE se confirma con un código antes de que
  // la cuenta quede vinculada al negocio (Authoriza: rol clienteInout).
  accountMode: 'guest' | 'login' | 'register' = 'guest';
  /** form: formulario · verify: código de correo · join: cuenta existente que aún no es cliente de este negocio */
  authStep: 'form' | 'verify' | 'join' = 'form';
  authLoading = false;
  authError = '';
  authInfo = '';
  registerData = {
    firstName: '', secondName: '', firstSurname: '', secondSurname: '',
    documentType: 'CC', documentNumber: '', birthdate: '', gender: '', civilStatus: '',
    phone: '', email: '', password: '', confirmPassword: '',
  };
  /** Mismos códigos que Authoriza usa en el registro de InOut y de Shotra. */
  readonly genders = [
    { value: 'M', label: 'Masculino' },
    { value: 'F', label: 'Femenino' },
    { value: 'O', label: 'Otro' },
  ];
  readonly civilStatuses = [
    { value: 'S', label: 'Soltero/a' },
    { value: 'C', label: 'Casado/a' },
    { value: 'U', label: 'Unión libre' },
    { value: 'D', label: 'Divorciado/a' },
    { value: 'V', label: 'Viudo/a' },
  ];
  /** Fecha máxima de nacimiento para el selector (18 años cumplidos hoy). */
  readonly maxBirthdate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0, 10);
  })();
  /** Aceptación para crear/vincular la cuenta. */
  accountConsents = { terms: false, habeasData: false };
  /** Aceptación para el pedido (obligatoria también como invitado). */
  orderConsents = { terms: false, habeasData: false };
  verifyEmail = '';
  verifyCode = '';
  /** La cuenta aún no autorizó sus datos ante esta tienda: se piden junto con el código. */
  verifyConsentRequired = false;
  showRegisterPassword = false;
  /** Datos de la cuenta del cliente con sesión (Authoriza), para el pedido. */
  clientProfile: any = null;
  /** Menú de la sesión junto al carrito. */
  sessionMenuOpen = false;
  /** Crédito del cliente con sesión en esta tienda (cupo, disponible, trámite). */
  clientCredit: any = null;
  /** Forma de pago elegida en el checkout con sesión. */
  paymentPreference: 'CONTADO' | 'CREDITO' = 'CONTADO';

  // ─── Formas de pago y pedidos programados (configurados por la tienda) ───
  /** null = el backend no las ofrece (versión anterior): checkout clásico. */
  paymentOptions: any = null;
  schedulingOptions: any = null;
  paymentPlan: string | null = null;
  deliveryMode: 'ASAP' | 'SCHEDULED' = 'ASAP';
  scheduleDate = '';
  scheduleSlots: { start: string; end: string; available: boolean; remaining: number | null; reason?: string }[] = [];
  slotsLoading = false;
  scheduledStart: string | null = null;
  planLabels = PAYMENT_PLAN_LABELS;
  planLabel = planLabel;
  /** Ubicación exacta de entrega capturada con el GPS del navegador. */
  deliveryLocation: { lat: number; lng: number; accuracy: number } | null = null;
  geoLoading = false;
  geoError = '';

  /** Documento legal abierto en el visor (términos / tratamiento de datos). */
  legalDoc: LegalDocument | null = null;
  /** Catálogo de Authoriza (document_types) para persona natural. */
  readonly documentTypes = [
    { value: 'CC', label: 'Cédula de ciudadanía' },
    { value: 'CE', label: 'Cédula de extranjería' },
    { value: 'PP', label: 'Pasaporte' },
  ];

  private get clientProfileKey(): string {
    return `${this.clientTokenKey}_profile`;
  }

  /** El pedido se muestra si compra como invitado o ya inició sesión; mientras
   * inicia sesión o crea su cuenta, el resto del checkout queda oculto. */
  get showOrderForm(): boolean {
    return this.clientLoggedIn || this.accountMode === 'guest';
  }

  /** Nombre completo del cliente con sesión, en mayúsculas (o su correo). */
  get clientDisplayName(): string {
    const p = this.clientProfile;
    const full = p ? [p.firstName, p.secondName, p.firstSurname, p.secondSurname].filter(Boolean).join(' ').trim() : '';
    return (full || this.checkoutData.customerName || this.clientEmail || '').toUpperCase();
  }

  get clientFirstName(): string {
    const first = this.clientProfile?.firstName || this.clientDisplayName.split(' ')[0] || 'Mi cuenta';
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }

  /** Con sesión solo se pide teléfono si la cuenta no tiene uno. */
  get clientNeedsPhone(): boolean {
    return this.clientLoggedIn && !this.clientProfile?.phone;
  }

  get deliveryMapsLink(): string | null {
    const l = this.deliveryLocation;
    return l ? `https://www.google.com/maps?q=${l.lat},${l.lng}` : null;
  }

  /** Captura la ubicación exacta del comprador (requiere su permiso y HTTPS). */
  captureDeliveryLocation(): void {
    this.geoError = '';
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.geoError = 'Tu navegador no permite obtener la ubicación.';
      return;
    }
    this.geoLoading = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.deliveryLocation = {
          lat: Number(pos.coords.latitude.toFixed(7)),
          lng: Number(pos.coords.longitude.toFixed(7)),
          accuracy: Math.round(pos.coords.accuracy),
        };
        this.geoLoading = false;
      },
      (err) => {
        this.geoLoading = false;
        this.geoError = err.code === err.PERMISSION_DENIED
          ? 'No diste permiso para usar tu ubicación. Puedes escribir la dirección.'
          : 'No pudimos obtener tu ubicación. Intenta de nuevo o escribe la dirección.';
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  clearDeliveryLocation(): void {
    this.deliveryLocation = null;
    this.geoError = '';
  }

  /** Abre el checkout en "Iniciar sesión" (desde el encabezado), aunque el carrito esté vacío. */
  openAccountLogin(): void {
    // En modo administrador no se inicia sesión como cliente de la tienda
    if (this.isAdminMode) return;
    this.setAccountMode('login');
    this.showCheckout = true;
    this.orderSuccess = null;
  }

  get orderConsentsAccepted(): boolean {
    return this.orderConsents.terms && this.orderConsents.habeasData;
  }

  private baseUrl = environment.apiUrl;
  private authorizaUrl = environment.auth.authorizaUrl;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private titleService: Title,
    private brandingService: TenantBrandingService,
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
      // ?vista=menu-chalk: vista previa de un diseño sin guardarlo
      this.previewMode = isMenuMode(queryParams['vista']) || queryParams['vista'] === 'grid' ? queryParams['vista'] : null;
      if (this.isAdminMode) {
        this.checkAuthentication();
        this.loadCurrentSlug();
      }
    });
  }

  loadMarketplaceData(): void {
    // Para ruta pública general, cargar todos los productos
    if (this.tenantId === 'home') {
      this.loadAllProducts();
      return;
    }
    
    // Check if it's a slug (not a UUID) — resolve it first
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.tenantId);
    
    if (!isUuid && this.tenantId !== 'current-tenant') {
      // Resolve slug to tenantId
      this.http.get<any>(`${this.baseUrl}/marketplace-config/resolve/${this.tenantId}`).subscribe({
        next: (resolved) => {
          this.tenantId = resolved.tenantId;
          this.loadTenantData(this.tenantId);
        },
        error: () => {
          // Slug not found — show empty state
          this.products = [];
          this.filteredProducts = [];
          this.loading = false;
        }
      });
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
    // Vitrina general: lo que cada tienda marcó visible en su MarketPlace. La
    // categoría del filtro es el sector del contrato de la tienda en Authoriza.
    Promise.all([
      this.http.get<any>(`${this.baseUrl}/products/all`).toPromise(),
      this.http.get<any[]>(`${this.baseUrl}/marketplace-config`).toPromise().catch(() => []),
    ]).then(async ([productsResponse, configs]) => {
      const raw: any[] = productsResponse?.data || [];
      (configs || []).forEach((c: any) => { if (c?.tenantId && c?.slug) this.homeStoreSlugs[c.tenantId] = c.slug; });

      const tenantIds = [...new Set(raw.map((p) => p.strTenantId).filter(Boolean))] as string[];
      const sectors = await Promise.all(tenantIds.map((id) =>
        this.http.get<any>(`${environment.auth.authorizaUrl}/contracts/tenant/${id}`).toPromise()
          .then((c) => c?.businessSector || 'general').catch(() => 'general')));
      tenantIds.forEach((id, i) => { this.homeTenantSectors[id] = sectors[i]; });

      const products: Product[] = raw.map((product: any) => ({
        ...product,
        views: Math.floor(Math.random() * 500) + 50,
        sales: Math.floor(Math.random() * 100) + 10,
        rating: Math.round((Math.random() * 2 + 3) * 10) / 10,
        image: product.images && product.images.length > 0 ? product.images[0].strImageUrl : null,
      }));
      this.products = this.interleaveByTenant(products);

      this.calculateStats();
      this.filteredProducts = [...this.products];
      this.createProductGroups();
      this.createFeaturedProducts();
      this.setupCarousel();
      this.loading = false;
    }).catch(() => {
      this.products = [];
      this.filteredProducts = [];
      this.loading = false;
    });
  }

  /** Home: sector (contrato en Authoriza) y slug de la tienda de cada producto. */
  private homeTenantSectors: Record<string, string> = {};
  private homeStoreSlugs: Record<string, string> = {};

  /**
   * Orden aleatorio justo entre tiendas: se barajan las tiendas y los productos
   * de cada una, y se toman por turnos (uno de cada tienda). Así una tienda con
   * muchos productos no copa el inicio de la vitrina.
   */
  private interleaveByTenant(products: Product[]): Product[] {
    const shuffle = <T>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const byTenant = new Map<string, Product[]>();
    for (const p of products) {
      const key = (p as any).strTenantId || '';
      byTenant.set(key, [...(byTenant.get(key) || []), p]);
    }
    const queues = shuffle([...byTenant.values()]).map(shuffle);
    const out: Product[] = [];
    while (queues.some((q) => q.length)) {
      for (const q of queues) if (q.length) out.push(q.shift()!);
    }
    return out;
  }

  /** Categoría para el filtro: en el home, la del sector de la tienda. */
  private categoryOf(product: Product): string {
    if (this.tenantId === 'home') {
      return this.getSectorCategory(this.homeTenantSectors[(product as any).strTenantId] || 'general');
    }
    return product.intCategoryId != null ? product.intCategoryId.toString() : '';
  }

  loadTenantData(tenantId: string): void {
    this.checkExistingClientSession();
    this.storeLogoUrl = null;
    this.brandingService.getPublic(tenantId).subscribe({
      next: (b) => (this.storeLogoUrl = b?.logoWebUrl || null),
      error: () => (this.storeLogoUrl = null),
    });
    Promise.all([
      this.http.get<any>(`${this.baseUrl}/products/tenant/${tenantId}`).toPromise(),
      this.http.get<any>(`${environment.auth.authorizaUrl}/contracts/tenant/${tenantId}`).toPromise().catch(() => ({ businessSector: 'general' })),
      this.http.get<any>(`${this.baseUrl}/marketplace-config/${tenantId}`).toPromise().catch(() => null),
      // Materiales de reventa visibles (precio/stock por presentación)
      this.http.get<any[]>(`${this.baseUrl}/products/tenant/${tenantId}/resale`).toPromise().catch(() => []),
      this.http.get<any>(`${this.baseUrl}/marketplace-config/${tenantId}/payment-options`).toPromise().catch(() => null),
      this.http.get<any>(`${this.baseUrl}/marketplace-config/${tenantId}/scheduling`).toPromise().catch(() => null),
      // Combos y kits de la tienda, y promociones en curso
      this.http.get<any[]>(`${this.baseUrl}/combos/tenant/${tenantId}/catalog`).toPromise().catch(() => []),
      this.http.get<any[]>(`${this.baseUrl}/promotions/tenant/${tenantId}/live`).toPromise().catch(() => []),
    ]).then(([productsResponse, contractResponse, configResponse, resaleResponse, paymentOptions, scheduling, combosResponse, livePromotions]) => {
      this.paymentOptions = paymentOptions || null;
      this.schedulingOptions = scheduling?.enabled ? scheduling : null;
      this.products = (productsResponse.data || []).map((product: any) => ({
        ...product,
        itemType: 'product',
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

      // Los materiales de reventa NO dependen de la selección de productos del
      // MarketPlace: su visibilidad se configura en el propio material.
      const resaleItems: Product[] = (resaleResponse || []).map((item: any) => ({
        ...item,
        intCategoryId: item.categoryId,
        views: Math.floor(Math.random() * 500) + 50,
        sales: Math.floor(Math.random() * 100) + 10,
        rating: Math.round((Math.random() * 2 + 3) * 10) / 10,
        image: item.images && item.images.length > 0 ? item.images[0].strImageUrl : null
      }));
      this.products = [...this.products, ...resaleItems];

      // Combos y kits: entran como un ítem más del catálogo (carrito, menú y
      // checkout funcionan igual). El precio lo confirma el servidor.
      const comboItems: Product[] = (combosResponse || []).map((c: any) => ({
        strId: c.strId,
        strName: c.strName,
        strDescription: c.strDescription || `Incluye: ${(c.components || []).map((x: any) => `${x.quantity} x ${x.name}`).join(', ')}`,
        fltPrice: Number(c.fltPrice) || 0,
        strLocation: '',
        intCategoryId: null as any,
        strStatus: 'active',
        itemType: c.itemType === 'kit' ? 'kit' : 'combo',
        // Combo con componentes bajo pedido (available = null): no tiene tope
        ingQuantity: c.available === null || c.available === undefined ? undefined : Number(c.available),
        ingReservedStock: 0,
        blnMadeToOrder: c.itemType !== 'kit' && (c.available === null || c.available === undefined),
        comboIncludes: (c.components || []).map((x: any) => `${x.quantity} x ${x.name}`),
        ...(Number(c.listPrice) > Number(c.fltPrice) ? { listPrice: Number(c.listPrice), promoLabel: `Ahorras ${this.formatCurrency(Number(c.listPrice) - Number(c.fltPrice))}` } : {}),
        image: c.strImageUrl || undefined,
      }));
      this.products = [...comboItems, ...this.products];
      this.applyLivePromotions(livePromotions || []);

      // Load display mode from config
      if (configResponse && configResponse.displayMode) {
        this.displayMode = configResponse.displayMode;
      }
      if (this.previewMode && !this.isAdminMode) this.displayMode = this.previewMode;
      this.storeWhatsapp = configResponse?.whatsapp || '';
      this.storeWelcome = configResponse?.welcomeMessage || '';
      
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
      const term = (this.searchTerm || '').toLowerCase();
      const matchesSearch = (product.strName || '').toLowerCase().includes(term) ||
                           (product.strDescription || '').toLowerCase().includes(term);
      const matchesCategory = this.selectedCategory === 'all' || this.categoryOf(product) === this.selectedCategory;
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

  /** Formato de pesos de los pedidos: "$2.362.200". */
  formatCurrency(value: number): string {
    return formatCop(value);
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
    // (los materiales de reventa no dependen de esa selección)
    let productsToUse = this.products;
    if (this.selectedProductIds.size > 0) {
      productsToUse = this.products.filter(p => this.isResale(p) || this.selectedProductIds.has(p.strId));
    } else if (this.selectedProductIds.size === 0 && this.tenantId !== 'home') {
      // Si no hay productos seleccionados, no mostrar ninguno (salvo reventa)
      productsToUse = this.products.filter(p => this.isResale(p));
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

  /** Reinicia el autoplay tras una interacción manual (para no saltar de inmediato). */
  private restartCarouselAutoplay(): void {
    if (typeof window === 'undefined' || this.carouselProducts.length === 0) return;
    if (this.carouselInterval) clearInterval(this.carouselInterval);
    this.startCarousel();
  }

  /** Ir a un slide específico (dots). */
  goToSlide(index: number): void {
    if (!this.carouselProducts.length) return;
    this.currentSlide = (index + this.carouselProducts.length) % this.carouselProducts.length;
    this.restartCarouselAutoplay();
  }

  /** Slide siguiente (flecha derecha). */
  nextSlide(): void {
    if (!this.carouselProducts.length) return;
    this.currentSlide = (this.currentSlide + 1) % this.carouselProducts.length;
    this.restartCarouselAutoplay();
  }

  /** Slide anterior (flecha izquierda). */
  prevSlide(): void {
    if (!this.carouselProducts.length) return;
    this.currentSlide = (this.currentSlide - 1 + this.carouselProducts.length) % this.carouselProducts.length;
    this.restartCarouselAutoplay();
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
      products: this.filteredProducts.filter(p => this.categoryOf(p) === String(group.category)).slice(0, 6)
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

  // ═══════ DISPLAY MODE ═══════
  setDisplayMode(mode: string): void {
    this.displayMode = mode;
  }

  /** Abre la tienda pública con el diseño elegido, aún sin guardar. */
  previewDisplayMode(): void {
    if (typeof window === 'undefined') return;
    const store = this.savedSlug || this.tenantId;
    window.open(`/marketplace/${store}?vista=${this.displayMode}`, '_blank', 'noopener');
  }

  isMenuMode(): boolean {
    return isMenuMode(this.displayMode);
  }

  get displayModeLabel(): string {
    const v = MENU_VARIANTS.find((m) => m.value === this.displayMode);
    return v ? `Menú · ${v.label}` : 'Tarjetas (Grid)';
  }

  /** La tienda pública se muestra como menú de restaurante (vista completa). */
  get showMenuBoard(): boolean {
    return this.isMenuMode() && !this.isAdminMode && this.tenantId !== 'home';
  }

  /** Cantidades para el menú: se recalcula solo cuando cambia el carrito. */
  get cartQuantities(): Record<string, number> {
    const key = this.cart.map((i) => `${i.product.strId}:${i.quantity}`).join('|');
    if (key !== this.menuQtyKey) {
      this.menuQtyKey = key;
      this.menuQuantities = Object.fromEntries(this.cart.map((i) => [i.product.strId, i.quantity]));
    }
    return this.menuQuantities;
  }

  decreaseFromMenu(product: Product): void {
    const item = this.cart.find((i) => i.product.strId === product.strId);
    if (!item) return;
    if (item.quantity > 1) this.updateCartQuantity(product.strId, item.quantity - 1);
    else this.removeFromCart(product.strId);
  }

  saveDisplayMode(): void {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (!token) return;

    const payload = {
      tenantId: this.tenantId,
      selectedProductIds: Array.from(this.selectedProductIds),
      displayMode: this.displayMode
    };

    this.http.post(`${this.baseUrl}/marketplace-config`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Modo de visualización guardado',
          text: this.isMenuMode() ? `Tu marketplace se mostrará como ${this.displayModeLabel.toLowerCase()}` : 'Tu marketplace se mostrará en tarjetas',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar el modo de visualización' });
      }
    });
  }

  getProductsByCategory(): { category: string; categoryId: string; products: Product[] }[] {
    const categoryMap: { [key: string]: string } = {
      '23': 'Alimentos y Restaurantes',
      '24': 'Moda y Belleza',
      '25': 'Ferretería y Electrónicos',
      '26': 'Hogar y Salud',
      '27': 'Deportes y Automotriz',
      '28': 'Servicios'
    };

    const grouped: { [key: string]: Product[] } = {};
    for (const product of this.filteredProducts) {
      const catId = product.intCategoryId?.toString() || 'other';
      if (!grouped[catId]) {
        grouped[catId] = [];
      }
      grouped[catId].push(product);
    }

    return Object.entries(grouped).map(([catId, products]) => ({
      category: categoryMap[catId] || 'Otros',
      categoryId: catId,
      products
    }));
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

  // ═══════ CART & CHECKOUT ═══════
  isResale(product: Product): boolean {
    return product.itemType === 'material' || product.itemType === 'material_t';
  }

  /** Stock disponible (para reventa, en presentaciones); null si no se conoce. */
  getAvailableStock(product: Product): number | null {
    if (product.ingQuantity === undefined || product.ingQuantity === null) return null;
    return Math.max(0, Number(product.ingQuantity) - Number(product.ingReservedStock || 0));
  }

  private warnStock(product: Product, available: number): void {
    Swal.fire({
      icon: 'warning',
      title: available > 0 ? 'Stock insuficiente' : 'Sin stock',
      text: available > 0
        ? `Solo hay ${available} unidad(es) disponibles de ${product.strName}.`
        : `${product.strName} no tiene stock disponible por ahora.`,
      confirmButtonText: 'Entendido'
    });
  }

  addToCart(product: Product): void {
    // En la vitrina general cada producto es de una tienda distinta: el pedido
    // se hace en la tienda del producto (su carrito, pagos y agenda).
    if (this.tenantId === 'home') {
      const tenant = (product as any).strTenantId;
      if (tenant) window.location.href = `/marketplace/${this.homeStoreSlugs[tenant] || tenant}`;
      return;
    }
    const existing = this.cart.find(item => item.product.strId === product.strId);
    const available = this.getAvailableStock(product);
    const wanted = (existing?.quantity || 0) + 1;
    // Los productos "bajo pedido" se fabrican: no se limitan por el stock
    if (available !== null && wanted > available && !this.isMadeToOrder(product)) {
      this.warnStock(product, available);
      return;
    }
    if (existing) {
      existing.quantity++;
    } else {
      this.cart.push({ product, quantity: 1 });
    }
    this.refreshSlotsIfScheduled();
    Swal.fire({ icon: 'success', title: 'Agregado', text: `${product.strName} añadido al carrito`, timer: 1200, showConfirmButton: false, position: 'top-end', toast: true });
  }

  removeFromCart(productId: string): void {
    this.cart = this.cart.filter(item => item.product.strId !== productId);
    this.refreshSlotsIfScheduled();
  }

  updateCartQuantity(productId: string, qty: number): void {
    const item = this.cart.find(i => i.product.strId === productId);
    if (item) {
      const available = this.getAvailableStock(item.product);
      if (available !== null && qty > available && !this.isMadeToOrder(item.product)) {
        this.warnStock(item.product, available);
        item.quantity = Math.max(1, available);
        return;
      }
      item.quantity = Math.max(1, qty);
      this.refreshSlotsIfScheduled();
    }
  }

  /** Tiene precio con promoción (o es un combo con ahorro). */
  hasPromo(product: Product): boolean {
    return !!product.listPrice && product.listPrice > product.fltPrice + 0.5;
  }

  /** Etiqueta de disponibilidad: "Bajo pedido" (se fabrica) o "Agotado". */
  stockTag(product: Product): { text: string; cls: string } | null {
    const available = this.getAvailableStock(product);
    if (available === null || available > 0) return null;
    if (this.isMadeToOrder(product)) {
      const h = Number(product.intProductionLeadHours) || 0;
      const lead = !h ? '' : h < 24 ? ` · listo en ~${h} h` : ` · listo en ~${Math.ceil(h / 24)} día(s)`;
      return { text: `🛠 Bajo pedido${lead}`, cls: 'tag-made' };
    }
    return { text: 'Agotado', cls: 'tag-out' };
  }

  /** Si se está programando, las franjas dependen del carrito: se recalculan. */
  private refreshSlotsIfScheduled(): void {
    if (this.deliveryMode === 'SCHEDULED' && this.scheduleDate) this.selectScheduleDate(this.scheduleDate, true);
  }

  isMadeToOrder(product: Product): boolean {
    const type = product.itemType || 'product';
    return (type === 'product' || type === 'combo') && !!product.blnMadeToOrder;
  }

  /** Unidades del carrito que habría que fabricar (superan el stock disponible). */
  get cartHasMadeToOrder(): boolean {
    return this.cart.some((i) => {
      if (!this.isMadeToOrder(i.product)) return false;
      const available = this.getAvailableStock(i.product);
      return available !== null && i.quantity > available;
    });
  }

  /** Formas de pago que ofrece la tienda para este carrito y este comprador. */
  get planChoices(): PlanChoice[] {
    const o = this.paymentOptions;
    if (!o) return [];
    const total = this.getCartTotal();
    const pct = (p: number) => Math.round((total * p) / 100);
    const choices: PlanChoice[] = [];

    if (o.contraEntrega?.enabled) {
      const overMax = o.contraEntrega.maxOrderTotal && total > o.contraEntrega.maxOrderTotal;
      const needsDeposit = this.cartHasMadeToOrder && o.madeToOrderRequiresDeposit;
      choices.push({
        plan: 'CONTRA_ENTREGA', label: this.planLabels['CONTRA_ENTREGA'],
        detail: 'Pagas cuando recibas tu pedido.',
        disabled: !!overMax || !!needsDeposit,
        note: needsDeposit ? 'Los productos por fabricar requieren un anticipo.'
          : overMax ? `No disponible: tu pedido (${this.formatCurrency(total)}) supera el tope de ${this.formatCurrency(o.contraEntrega.maxOrderTotal)} para contra entrega.` : undefined,
      });
    }
    if (o.contado?.enabled) {
      choices.push({
        plan: 'CONTADO', label: this.planLabels['CONTADO'],
        detail: `Pagas ${this.formatCurrency(total)} ahora (transferencia, Nequi…) y subes el comprobante.`,
        disabled: false,
      });
    }
    if (o.mitadMitad?.enabled) {
      const dep = pct(o.mitadMitad.depositPercent);
      choices.push({
        plan: 'MITAD_MITAD', label: planLabel('MITAD_MITAD', { depositPercent: o.mitadMitad.depositPercent }),
        detail: `Pagas ${this.formatCurrency(dep)} ahora y ${this.formatCurrency(total - dep)} al recibir.`,
        disabled: false,
      });
    }
    if (o.planSepare?.enabled) {
      const underMin = o.planSepare.minOrderTotal && total < o.planSepare.minOrderTotal;
      const deadline = new Date(Date.now() + o.planSepare.maxDays * 86400000)
        .toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
      choices.push({
        plan: 'PLAN_SEPARE', label: this.planLabels['PLAN_SEPARE'],
        detail: `Separas con ${this.formatCurrency(pct(o.planSepare.minInitialPercent))} y completas el pago antes del ${deadline}. Te lo entregamos pagado.`,
        disabled: !this.clientLoggedIn || !!underMin,
        note: !this.clientLoggedIn ? 'Inicia sesión o crea tu cuenta para usarlo.'
          : underMin ? `No disponible: tu pedido (${this.formatCurrency(total)}) no alcanza el mínimo de ${this.formatCurrency(o.planSepare.minOrderTotal)}.` : undefined,
      });
    }
    if (o.credito?.enabled && this.clientLoggedIn && this.clientCredit?.eligibility?.approvedLimit > 0) {
      const e = this.clientCredit.eligibility;
      choices.push({
        plan: 'CREDITO', label: this.planLabels['CREDITO'],
        detail: `Disponible ${this.formatCurrency(e.available)} · pagas a ${e.termDays} días.`,
        disabled: !this.canPayWithCredit,
      });
    }
    return choices;
  }

  // planChoices / scheduleDates son getters que devuelven objetos nuevos en cada
  // detección de cambios: sin trackBy el *ngFor recreaba los elementos y un clic
  // podía perderse (el radio del 50/50 "no se dejaba" seleccionar).
  trackByPlan = (_: number, c: PlanChoice) => c.plan;
  trackByValue = (_: number, d: { value: string }) => d.value;
  trackByStart = (_: number, s: { start: string }) => s.start;

  /** Forma de pago que se enviará: la elegida si sigue disponible, si no la primera disponible. */
  get effectivePlan(): string | null {
    const choices = this.planChoices.filter((c) => !c.disabled);
    return choices.find((c) => c.plan === this.paymentPlan)?.plan || choices[0]?.plan || null;
  }

  /** Días que se pueden programar (hora de Colombia), con su horario activo. */
  get scheduleDates(): { value: string; label: string }[] {
    const s = this.schedulingOptions;
    if (!s) return [];
    const dates: { value: string; label: string }[] = [];
    for (let i = 0; i <= s.maxDaysAhead; i++) {
      const d = new Date(Date.now() + i * 86400000);
      const value = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
      const weekday = new Date(`${value}T12:00:00Z`).getUTCDay();
      if (!s.hours?.find((h: any) => h.day === weekday)?.active) continue;
      const label = i === 0 ? 'Hoy' : i === 1 ? 'Mañana'
        : new Date(`${value}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
      dates.push({ value, label });
    }
    return dates;
  }

  setDeliveryMode(mode: 'ASAP' | 'SCHEDULED'): void {
    this.deliveryMode = mode;
    if (mode === 'SCHEDULED' && !this.scheduleDate && this.scheduleDates.length) {
      this.selectScheduleDate(this.scheduleDates[0].value);
    }
  }

  /** Franjas del día para lo que hay en el carrito (considera la cola y la fabricación). */
  selectScheduleDate(date: string, keepSelection = false): void {
    const previous = keepSelection ? this.scheduledStart : null;
    this.scheduleDate = date;
    this.scheduledStart = null;
    this.scheduleSlots = [];
    this.slotsLoading = true;
    this.http.post<any>(`${this.baseUrl}/orders/marketplace/slots`, {
      tenantId: this.tenantId,
      date,
      items: this.orderItemsPayload(),
    }).subscribe({
      next: (res) => {
        this.scheduleSlots = res?.slots || [];
        this.slotsLoading = false;
        if (previous) {
          // El carrito cambió: se conserva la franja si todavía alcanza
          if (this.scheduleSlots.some((s) => s.start === previous && s.available)) this.scheduledStart = previous;
          else Swal.fire({ icon: 'info', title: 'Elige otra franja', text: 'Con los cambios en tu carrito, la franja elegida ya no está disponible.', timer: 2600, showConfirmButton: false, toast: true, position: 'top-end' });
        }
      },
      error: () => { this.slotsLoading = false; },
    });
  }

  slotLabel(slot: { start: string; end: string }): string {
    const f = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    return `${f(slot.start)} – ${f(slot.end)}`;
  }

  slotReason(reason?: string): string {
    const m: Record<string, string> = { PASADA: 'Ya pasó', ANTICIPACION: 'Muy pronto', PREPARACION: 'No alcanza a estar listo', LLENA: 'Llena' };
    return reason ? m[reason] || '' : '';
  }

  get hasAvailableSlots(): boolean {
    return this.scheduleSlots.some((s) => s.available);
  }

  private orderItemsPayload() {
    return this.cart.map(item => ({
      productId: item.product.strId,
      itemType: item.product.itemType || 'product',
      productName: item.product.strName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.product.fltPrice),
      subtotal: Number(item.product.fltPrice) * Number(item.quantity),
    }));
  }

  /** Enlace de seguimiento del pedido recién creado. */
  get trackingUrl(): string | null {
    const token = this.orderSuccess?.order?.trackingToken;
    if (!token) return null;
    return `${window.location.origin}/marketplace/${this.marketplaceSlug || this.tenantId}/pedido/${token}`;
  }

  get successNeedsPayment(): boolean {
    const o = this.orderSuccess?.order;
    return !!o?.trackingToken && ['CONTADO', 'MITAD_MITAD', 'PLAN_SEPARE'].includes(o.paymentPlan);
  }

  successSchedule(): string | null {
    const o = this.orderSuccess?.order;
    return o?.scheduledStart ? formatScheduleRange(o.scheduledStart, o.scheduledEnd) : null;
  }

  copyTrackingUrl(): void {
    if (!this.trackingUrl) return;
    navigator.clipboard?.writeText(this.trackingUrl).then(() => {
      Swal.fire({ icon: 'success', title: 'Enlace copiado', timer: 1200, showConfirmButton: false, toast: true, position: 'top-end' });
    }).catch(() => {});
  }

  /**
   * Aplica al catálogo la mejor promoción en curso de cada ítem (para
   * mostrarla). Mismo criterio que el servidor; el tope del período lo aplica
   * el servidor y se concilia al enviar el pedido (reconcilePrices).
   */
  private applyLivePromotions(promotions: any[]): void {
    if (!promotions.length) return;
    for (const product of this.products) {
      const type = product.itemType || 'product';
      // Sobre el precio del ítem (en un combo, su precio de combo)
      const base = product.fltPrice;
      let best: { discount: number; promo: any } | null = null;
      for (const promo of promotions) {
        const matches = promo.scope === 'ALL' || (promo.targets || []).some((t: any) =>
          t.type === 'category'
            ? type !== 'combo' && type !== 'kit' && product.intCategoryId !== null && product.intCategoryId !== undefined && String(product.intCategoryId) === String(t.id)
            : t.type === type && t.id === product.strId);
        if (!matches) continue;
        const raw = promo.discountType === 'PERCENT' ? base * (Math.min(100, Number(promo.value)) / 100) : Number(promo.value);
        const discount = Math.round(Math.min(raw, base) * 100) / 100;
        if (discount > 0 && (!best || discount > best.discount)) best = { discount, promo };
      }
      if (!best) continue;
      // El combo conserva su precio normal (suma de componentes) como referencia
      product.listPrice = product.listPrice && product.listPrice > base ? product.listPrice : base;
      product.fltPrice = Math.round((base - best.discount) * 100) / 100;
      product.promoLabel = best.promo.label;
      product.promoName = best.promo.strName;
    }
  }

  /**
   * Antes de enviar el pedido se pide el precio al servidor (el mismo cálculo
   * con el que se crea el pedido). Si algo cambió (terminó una promoción, tope
   * del período), se actualiza el carrito y se avisa: devuelve false.
   */
  private async reconcilePrices(): Promise<boolean> {
    try {
      const quote: any = await this.http.post(`${this.baseUrl}/promotions/marketplace/quote`, {
        tenantId: this.tenantId,
        items: this.cart.map((i) => ({ productId: i.product.strId, itemType: i.product.itemType || 'product', quantity: Number(i.quantity) })),
      }).toPromise();
      const before = this.getCartTotal();
      (quote?.items || []).forEach((line: any, idx: number) => {
        const item = this.cart[idx];
        if (!item || item.product.strId !== line.productId) return;
        if (Math.abs(Number(line.unitPrice) - Number(item.product.fltPrice)) >= 0.5) {
          item.product.fltPrice = Number(line.unitPrice);
          if (!line.promotion) item.product.promoLabel = undefined;
        }
      });
      if (Math.abs(this.getCartTotal() - before) >= 0.5) {
        await Swal.fire({
          icon: 'info',
          title: 'Actualizamos los precios',
          text: `Algunos precios cambiaron (por ejemplo, terminó una promoción). El total ahora es ${this.formatCurrency(this.getCartTotal())}. Revisa tu pedido y vuelve a confirmarlo.`,
          confirmButtonText: 'Revisar',
        });
        return false;
      }
    } catch {
      // Si la cotización falla, el servidor igual fija el precio al crear el pedido
    }
    return true;
  }

  getCartTotal(): number {
    return this.cart.reduce((sum, item) => sum + (item.product.fltPrice * item.quantity), 0);
  }

  getCartCount(): number {
    return this.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  openCheckout(): void {
    if (this.cart.length === 0) return;
    this.showCheckout = true;
    this.orderSuccess = null;
  }

  closeCheckout(): void {
    this.showCheckout = false;
  }

  // ═══════ SESIÓN OPCIONAL DE CLIENTE (rol clienteInout) ═══════

  /** Restaura la sesión de cliente si hay un token guardado válido para ESTE tenant. */
  private checkExistingClientSession(): void {
    if (typeof window === 'undefined') return;
    const token = sessionStorage.getItem(this.clientTokenKey);
    if (!token) return;

    const payload = decodeJwtPayload(token);
    const isValid = payload?.rol === 'clienteInout'
      && payload?.tenantId === this.tenantId
      && (!payload?.exp || payload.exp * 1000 > Date.now());

    if (isValid) {
      this.clientToken = token;
      this.clientEmail = payload.email || '';
      this.clientLoggedIn = true;
      this.checkoutData.customerEmail = this.clientEmail;
      let profile: any = null;
      try {
        profile = JSON.parse(sessionStorage.getItem(this.clientProfileKey) || 'null');
      } catch { /* perfil corrupto: se vuelve a pedir */ }
      if (profile) this.prefillFromProfile(profile);
      else this.fetchClientProfile();
      this.prefillFromLastOrder();
      this.loadClientCredit();
    } else {
      sessionStorage.removeItem(this.clientTokenKey);
      sessionStorage.removeItem(this.clientProfileKey);
    }
  }

  /** Precarga nombre/teléfono con los datos de la cuenta (Authoriza). Solo
   * llena campos vacíos: no pisa lo que el cliente ya escribió. */
  private prefillFromProfile(profile: any): void {
    if (!profile) return;
    this.clientProfile = profile;
    const fullName = [profile.firstName, profile.secondName, profile.firstSurname, profile.secondSurname]
      .filter(Boolean).join(' ').trim();
    if (!this.checkoutData.customerName.trim() && fullName) this.checkoutData.customerName = fullName;
    if (!this.checkoutData.customerPhone.trim() && profile.phone) this.checkoutData.customerPhone = profile.phone;
  }

  // ═══════ CRÉDITO DEL CLIENTE EN LA TIENDA ═══════

  /** Crédito del cliente con sesión: cupo, disponible, plazo y estado del trámite. */
  private loadClientCredit(): void {
    if (!this.clientToken) return;
    fetch(`${this.baseUrl}/credit/marketplace/me`, { headers: { Authorization: `Bearer ${this.clientToken}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((c) => {
        this.clientCredit = c;
        if (!this.canPayWithCredit) this.paymentPreference = 'CONTADO';
      })
      .catch(() => { this.clientCredit = null; });
  }

  /** Crédito aprobado, sin mora, y el total cabe en el cupo disponible. */
  get canPayWithCredit(): boolean {
    const e = this.clientCredit?.eligibility;
    return !!e?.eligible && this.getCartTotal() <= (e.available || 0) + 0.005;
  }

  /** Texto de estado del crédito para el checkout (o null si no aplica). */
  get creditStatusText(): string | null {
    const c = this.clientCredit;
    if (!c) return null;
    const e = c.eligibility;
    if (c.suspended) return 'Tu crédito en esta tienda está suspendido.';
    if (e?.approvedLimit > 0 && !e.eligible) return e.reason;
    if (e?.eligible && this.getCartTotal() > e.available) return `Tu pedido supera tu cupo disponible (${this.formatCurrency(e.available)}).`;
    if (['SOLICITADA', 'VALIDADA', 'CUPO_ASIGNADO'].includes(c.requestStatus)) return 'Tu solicitud de crédito está en trámite. Te avisaremos cuando sea aprobada.';
    if (c.requestStatus === 'RECHAZADA' && !(e?.approvedLimit > 0)) return `Tu solicitud de crédito no fue aprobada${c.rejectionReason ? ': ' + c.rejectionReason : ''}.`;
    return null;
  }

  /** ¿Puede enviar una nueva solicitud (no tiene una en trámite)? */
  get canRequestCredit(): boolean {
    const c = this.clientCredit;
    return !!c && !['SOLICITADA', 'VALIDADA', 'CUPO_ASIGNADO'].includes(c.requestStatus);
  }

  async requestCredit(): Promise<void> {
    if (!this.clientToken) return;
    const approved = this.clientCredit?.eligibility?.approvedLimit > 0;
    const res = await Swal.fire({
      title: approved ? 'Solicitar aumento de cupo' : 'Solicitar crédito',
      html: `
        <div class="pf-form">
          <p class="pf-note">${this.businessName ? `<strong>${this.escapeHtml(this.businessName)}</strong> revisará` : 'El negocio revisará'} tu solicitud y te informará la decisión. Si es aprobada podrás pagar tus pedidos a crédito, dentro de tu cupo y plazo.</p>
          <label>Cupo que solicitas *<input id="mc-amount" type="number" min="1" step="1000" class="swal2-input" placeholder="Ej.: 500000"></label>
          <label>Plazo para pagar *
            <select id="mc-term" class="swal2-select">
              ${[8, 15, 30, 45, 60].map((d) => `<option value="${d}" ${d === 30 ? 'selected' : ''}>${d} días</option>`).join('')}
            </select></label>
          <label>Comentarios<textarea id="mc-notes" class="swal2-textarea" maxlength="1000" placeholder="Ej.: compro semanalmente para mi tienda"></textarea></label>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Enviar solicitud',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e65c00',
      preConfirm: () => {
        const amount = Number((document.getElementById('mc-amount') as HTMLInputElement).value);
        if (!(amount > 0)) { Swal.showValidationMessage('Indica el cupo que solicitas.'); return false; }
        return {
          requestedAmount: amount,
          requestedTermDays: Number((document.getElementById('mc-term') as HTMLSelectElement).value),
          notes: (document.getElementById('mc-notes') as HTMLTextAreaElement).value.trim() || undefined,
          customerName: this.clientDisplayName || this.clientEmail,
        };
      },
    });
    if (!res.isConfirmed || !res.value) return;
    try {
      const r = await fetch(`${this.baseUrl}/credit/marketplace/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.clientToken}` },
        body: JSON.stringify(res.value),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || 'No se pudo enviar la solicitud.');
      Swal.fire({ icon: 'success', title: 'Solicitud enviada', text: 'Te avisaremos cuando el negocio la revise.', timer: 2200, showConfirmButton: false });
      this.loadClientCredit();
    } catch (err: any) {
      Swal.fire('Error', err?.message || 'No se pudo enviar la solicitud.', 'error');
    }
  }

  private escapeHtml(v: string): string {
    return String(v ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
    )[c]);
  }

  /** Perfil de la cuenta desde Authoriza (sesiones abiertas antes de guardar el perfil). */
  private fetchClientProfile(): void {
    if (!this.clientToken) return;
    fetch(`${this.authorizaUrl}/auth/marketplace/client/me`, {
      headers: { Authorization: `Bearer ${this.clientToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((profile: any) => {
        if (!profile) return;
        sessionStorage.setItem(this.clientProfileKey, JSON.stringify(profile));
        this.prefillFromProfile(profile);
      })
      .catch(() => { /* sin perfil: se usan los datos del último pedido */ });
  }

  /** Dirección (y nombre/teléfono más recientes) de su último pedido en esta tienda. */
  private prefillFromLastOrder(): void {
    if (!this.clientToken) return;
    fetch(`${this.baseUrl}/orders/marketplace/me/last-contact`, {
      headers: { Authorization: `Bearer ${this.clientToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((last: any) => {
        if (!last) return;
        if (last.customerAddress && !this.checkoutData.customerAddress.trim()) this.checkoutData.customerAddress = last.customerAddress;
        if (last.customerPhone && !this.checkoutData.customerPhone.trim()) this.checkoutData.customerPhone = last.customerPhone;
        if (last.customerName && !this.checkoutData.customerName.trim()) this.checkoutData.customerName = last.customerName;
      })
      .catch(() => { /* sin historial: se deja el formulario como está */ });
  }

  setAccountMode(mode: 'guest' | 'login' | 'register'): void {
    this.accountMode = mode;
    this.authStep = 'form';
    this.authError = '';
    this.authInfo = '';
  }

  openLegal(key: LegalDocKey): void {
    this.legalDoc = buildLegalDocument(key, { businessName: this.businessName });
  }

  closeLegal(): void {
    this.legalDoc = null;
  }

  /** POST a los endpoints públicos de clientes del MarketPlace en Authoriza.
   * fetch() directo, NO HttpClient: el interceptor global reemplazaría el
   * header Authorization por el token de staff si hay una sesión de
   * administrador abierta en el mismo navegador. */
  private async authPost(path: string, body: any): Promise<any> {
    const res = await fetch(`${this.authorizaUrl}/auth/marketplace/client/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: this.tenantId, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data?.message || 'No se pudo completar la solicitud.');
      err.code = data?.code;
      throw err;
    }
    return data;
  }

  private consentPayload() {
    return {
      acceptTerms: true,
      acceptHabeasData: true,
      termsVersion: LEGAL_VERSIONS.terms,
      habeasDataVersion: LEGAL_VERSIONS.habeasData,
    };
  }

  /** Respuesta de login/registro/verificación: pide código o abre la sesión. */
  private handleAuthResult(result: any, email: string): void {
    if (result?.verificationRequired) {
      this.verifyEmail = email;
      this.verifyCode = '';
      this.verifyConsentRequired = !!result.consentRequired;
      if (this.verifyConsentRequired) this.accountConsents = { terms: false, habeasData: false };
      this.authStep = 'verify';
      this.authInfo = result.message || 'Te enviamos un código a tu correo.';
      return;
    }
    this.applyClientToken(result?.access_token, result?.profile);
  }

  private applyClientToken(token: string, profile?: any): void {
    const payload = token ? decodeJwtPayload(token) : null;
    if (!token || payload?.rol !== 'clienteInout' || payload?.tenantId !== this.tenantId) {
      this.authError = 'No se pudo abrir tu sesión de cliente en esta tienda.';
      return;
    }
    sessionStorage.setItem(this.clientTokenKey, token);
    if (profile) sessionStorage.setItem(this.clientProfileKey, JSON.stringify(profile));
    this.clientToken = token;
    this.clientEmail = payload.email || this.verifyEmail;
    this.clientLoggedIn = true;
    this.checkoutData.customerEmail = this.clientEmail;
    // Precargar el pedido con los datos guardados de la cuenta y su último pedido
    this.prefillFromProfile(profile || {
      firstName: this.registerData.firstName, firstSurname: this.registerData.firstSurname, phone: this.registerData.phone,
    });
    this.prefillFromLastOrder();
    this.loadClientCredit();
    // Aceptó estas mismas versiones al crear/vincular su cuenta
    if (this.accountConsents.terms && this.accountConsents.habeasData) {
      this.orderConsents = { terms: true, habeasData: true };
    }
    this.authStep = 'form';
    this.authError = '';
    this.authInfo = '';
    this.clientLoginData = { email: '', password: '' };
    this.registerData.password = '';
    this.registerData.confirmPassword = '';
    // Sin productos en el carrito no hay pedido que continuar: se cierra el
    // panel y el cliente sigue en la tienda (antes quedaba en "Tu Pedido" vacío)
    if (this.cart.length === 0) this.showCheckout = false;
    Swal.fire({ icon: 'success', title: '¡Listo!', text: `Sesión iniciada como ${this.clientEmail}`, timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' });
  }

  async clientLogin(): Promise<void> {
    const email = this.clientLoginData.email.trim();
    if (!email || !this.clientLoginData.password) {
      this.authError = 'Ingresa tu correo y contraseña.';
      return;
    }
    this.authLoading = true;
    this.authError = '';
    try {
      const result = await this.authPost('login', { email, password: this.clientLoginData.password });
      this.handleAuthResult(result, email);
    } catch (err: any) {
      if (err?.code === 'NOT_A_CLIENT' || err?.code === 'CONSENT_REQUIRED') {
        // NOT_A_CLIENT: tiene cuenta en CycloNet pero no es cliente de ESTA
        // tienda. CONSENT_REQUIRED: es cliente (lo creó el negocio) pero no ha
        // aceptado los términos de la tienda. En ambos casos se aceptan una
        // vez y se continúa con la misma contraseña.
        this.accountConsents = { terms: false, habeasData: false };
        this.authStep = 'join';
        this.authInfo = err.message;
      } else {
        this.authError = err?.message || 'No se pudo iniciar sesión.';
      }
    } finally {
      this.authLoading = false;
    }
  }

  /** Vincula una cuenta existente a esta tienda (prueba su contraseña + acepta términos). */
  async joinStore(): Promise<void> {
    if (!this.accountConsents.terms || !this.accountConsents.habeasData) {
      this.authError = 'Debes aceptar los Términos y la autorización de tratamiento de datos.';
      return;
    }
    const email = this.clientLoginData.email.trim();
    this.authLoading = true;
    this.authError = '';
    try {
      const result = await this.authPost('register', { email, password: this.clientLoginData.password, ...this.consentPayload() });
      this.handleAuthResult(result, email);
    } catch (err: any) {
      this.authError = err?.message || 'No se pudo vincular tu cuenta.';
    } finally {
      this.authLoading = false;
    }
  }

  async clientRegister(): Promise<void> {
    const d = this.registerData;
    const email = d.email.trim().toLowerCase();
    if (!d.firstName.trim() || !d.firstSurname.trim() || !d.phone.trim() || !email) {
      this.authError = 'Completa nombre, apellido, teléfono y correo.';
      return;
    }
    if (!d.documentType || !/^[A-Za-z0-9-]{4,20}$/.test(d.documentNumber.replace(/[\s.]/g, ''))) {
      this.authError = 'Indica tu tipo y número de documento.';
      return;
    }
    if (!d.birthdate) {
      this.authError = 'Indica tu fecha de nacimiento.';
      return;
    }
    if (d.birthdate > this.maxBirthdate) {
      this.authError = 'Debes ser mayor de 18 años para crear una cuenta.';
      return;
    }
    if (!d.gender || !d.civilStatus) {
      this.authError = 'Selecciona tu sexo y tu estado civil.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.authError = 'Ingresa un correo válido.';
      return;
    }
    if (d.password.length < 8) {
      this.authError = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }
    if (d.password !== d.confirmPassword) {
      this.authError = 'Las contraseñas no coinciden.';
      return;
    }
    if (!this.accountConsents.terms || !this.accountConsents.habeasData) {
      this.authError = 'Debes aceptar los Términos y la autorización de tratamiento de datos.';
      return;
    }

    this.authLoading = true;
    this.authError = '';
    try {
      const result = await this.authPost('register', {
        email,
        password: d.password,
        firstName: d.firstName.trim(),
        secondName: d.secondName.trim() || undefined,
        firstSurname: d.firstSurname.trim(),
        secondSurname: d.secondSurname.trim() || undefined,
        birthdate: d.birthdate,
        gender: d.gender,
        civilStatus: d.civilStatus,
        documentType: d.documentType,
        documentNumber: d.documentNumber.replace(/[\s.]/g, ''),
        phone: d.phone.trim(),
        ...this.consentPayload(),
      });
      this.handleAuthResult(result, email);
    } catch (err: any) {
      if (err?.code === 'EMAIL_ALREADY_REGISTERED') {
        // Ya tiene cuenta (quizá de otra tienda o app de CycloNet): que inicie sesión
        this.setAccountMode('login');
        this.clientLoginData.email = email;
        this.authInfo = err.message;
      } else {
        this.authError = err?.message || 'No se pudo crear la cuenta.';
      }
    } finally {
      this.authLoading = false;
    }
  }

  async verifyClientCode(): Promise<void> {
    const code = (this.verifyCode || '').replace(/\D/g, '');
    if (code.length !== 6) {
      this.authError = 'Ingresa el código de 6 dígitos.';
      return;
    }
    if (this.verifyConsentRequired && (!this.accountConsents.terms || !this.accountConsents.habeasData)) {
      this.authError = 'Debes aceptar los Términos y la autorización de tratamiento de datos.';
      return;
    }
    this.authLoading = true;
    this.authError = '';
    try {
      const consents = this.verifyConsentRequired ? this.consentPayload() : {};
      const result = await this.authPost('verify', { email: this.verifyEmail, code, ...consents });
      this.verifyConsentRequired = false;
      this.applyClientToken(result?.access_token, result?.profile);
    } catch (err: any) {
      if (err?.code === 'CONSENT_REQUIRED' && !this.verifyConsentRequired) {
        // El código es válido pero falta la autorización ante esta tienda:
        // se muestran los checks y se reintenta con el mismo código
        this.verifyConsentRequired = true;
        this.accountConsents = { terms: false, habeasData: false };
        this.authError = 'Acepta los Términos y la autorización de datos de esta tienda para continuar.';
        return;
      }
      this.authError = err?.message || 'No se pudo confirmar el código.';
    } finally {
      this.authLoading = false;
    }
  }

  async resendClientCode(): Promise<void> {
    this.authError = '';
    try {
      const result = await this.authPost('resend-code', { email: this.verifyEmail });
      this.authInfo = result?.message || 'Te enviamos un nuevo código.';
    } catch (err: any) {
      this.authError = err?.message || 'No se pudo reenviar el código.';
    }
  }

  clientLogout(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.clientTokenKey);
      sessionStorage.removeItem(this.clientProfileKey);
    }
    this.clientToken = null;
    this.clientLoggedIn = false;
    this.clientEmail = '';
    this.clientProfile = null;
    this.clientCredit = null;
    this.paymentPreference = 'CONTADO';
    this.sessionMenuOpen = false;
    this.setAccountMode('guest');
  }

  async submitOrder(): Promise<void> {
    if (this.cart.length === 0 || this.checkoutSending) return;
    // Con sesión, nombre/teléfono/correo vienen de la cuenta
    if (this.clientLoggedIn) {
      this.checkoutData.customerName = this.clientDisplayName;
      if (this.clientProfile?.phone) this.checkoutData.customerPhone = this.clientProfile.phone;
      this.checkoutData.customerEmail = this.clientEmail;
    }
    if (!this.checkoutData.customerName.trim() || !this.checkoutData.customerPhone.trim()) {
      Swal.fire({ icon: 'warning', title: 'Datos requeridos', text: this.clientLoggedIn ? 'Ingresa tu teléfono para continuar.' : 'Ingresa tu nombre y teléfono para continuar.' });
      return;
    }
    // Invitado: aceptación obligatoria con el pedido. Con sesión ya se aceptó
    // al registrarse o al iniciar sesión.
    if (!this.clientLoggedIn && (!this.orderConsents.terms || !this.orderConsents.habeasData)) {
      Swal.fire({
        icon: 'warning',
        title: 'Falta tu autorización',
        text: 'Para hacer el pedido debes aceptar los Términos y Condiciones y autorizar el tratamiento de tus datos personales.',
      });
      return;
    }

    const plan = this.paymentOptions ? this.effectivePlan : null;
    if (this.paymentOptions && !plan) {
      Swal.fire({ icon: 'warning', title: 'Forma de pago', text: 'No hay una forma de pago disponible para este pedido. Revisa las opciones o contacta a la tienda.' });
      return;
    }
    if (this.deliveryMode === 'SCHEDULED' && !this.scheduledStart) {
      Swal.fire({ icon: 'warning', title: 'Elige una franja', text: 'Selecciona el día y la franja horaria de entrega, o elige "Lo antes posible".' });
      return;
    }

    this.checkoutSending = true;
    // El precio final lo pone el servidor: si cambió, se muestra antes de enviar
    if (!(await this.reconcilePrices())) {
      this.checkoutSending = false;
      return;
    }
    const subtotal = this.getCartTotal();

    const payload = {
      tenantId: this.tenantId,
      customerName: this.checkoutData.customerName.trim(),
      customerPhone: this.checkoutData.customerPhone.trim(),
      customerAddress: this.checkoutData.customerAddress.trim() || undefined,
      customerEmail: this.checkoutData.customerEmail.trim() || undefined,
      items: this.orderItemsPayload(),
      notes: this.checkoutData.notes.trim() || undefined,
      subtotal: Number(subtotal),
      tax: 0,
      total: Number(subtotal),
      ...(this.clientLoggedIn ? {} : this.consentPayload()),
      ...(this.deliveryLocation ? { deliveryLatitude: this.deliveryLocation.lat, deliveryLongitude: this.deliveryLocation.lng } : {}),
      // Formas de pago configuradas por la tienda; sin ellas, el checkout clásico
      ...(plan
        ? { paymentPlan: plan }
        : this.clientLoggedIn ? { paymentPreference: this.canPayWithCredit && this.paymentPreference === 'CREDITO' ? 'CREDITO' : 'CONTADO' } : {}),
      ...(this.deliveryMode === 'SCHEDULED' && this.scheduledStart ? { scheduledStart: this.scheduledStart } : {}),
    };

    const onSuccess = (response: any) => {
      this.checkoutSending = false;
      this.orderSuccess = response;
      this.cart = [];
      this.checkoutData = { customerName: '', customerPhone: '', customerAddress: '', customerEmail: this.clientEmail, notes: '' };
      this.deliveryLocation = null;
      if (this.clientLoggedIn) {
        this.prefillFromProfile(this.clientProfile);
        this.prefillFromLastOrder();
        this.loadClientCredit();
        this.paymentPreference = 'CONTADO';
      }
      this.paymentPlan = null;
      this.deliveryMode = 'ASAP';
      this.scheduleDate = '';
      this.scheduleSlots = [];
      this.scheduledStart = null;

      if (response.whatsapp) {
        const o = response.order || {};
        const pago = o.paymentPlan
          ? ` - ${planLabel(o.paymentPlan, o).replace(/^\S+\s/, '')}`
          : o.requestedPaymentType === 'CREDITO' ? ' - A crédito' : ' - Contra-entrega';
        const cuando = o.scheduledStart ? ` - Entrega: ${formatScheduleRange(o.scheduledStart, o.scheduledEnd)}` : '';
        const msg = encodeURIComponent(`¡Nuevo pedido ${o.orderCode}! - ${payload.customerName} - Total: ${this.formatCurrency(subtotal)}${pago}${cuando}`);
        window.open(`https://wa.me/${response.whatsapp}?text=${msg}`, '_blank');
      }
    };

    const onError = (message?: string) => {
      this.checkoutSending = false;
      Swal.fire({ icon: 'error', title: 'Error', text: message || 'No se pudo crear el pedido. Intenta de nuevo.' });
    };

    if (this.clientLoggedIn && this.clientToken) {
      // Comprando con sesión iniciada: fetch() directo (ver nota en
      // clientLogin) para que el interceptor global no reemplace el token.
      fetch(`${this.baseUrl}/orders/marketplace/authenticated`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.clientToken}` },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.message || 'No se pudo crear el pedido.');
          return data;
        })
        .then(onSuccess)
        .catch((err) => onError(err?.message));
    } else {
      this.http.post<any>(`${this.baseUrl}/orders/marketplace`, payload).subscribe({
        next: onSuccess,
        error: (err) => onError(err.error?.message),
      });
    }
  }

  // ═══════ SLUG EDITOR ═══════
  loadCurrentSlug(): void {
    this.http.get<any>(`${this.baseUrl}/marketplace-config/${this.tenantId}`).subscribe({
      next: (config) => {
        if (config?.slug) {
          this.marketplaceSlug = config.slug;
          this.savedSlug = config.slug;
          this.generateStoreQr();
        }
      },
      error: () => {}
    });
  }

  getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://app.cyclonet.com.co';
  }

  /** URL pública completa de la tienda ya guardada. */
  getStoreUrl(): string {
    return `${this.getBaseUrl()}/marketplace/${this.savedSlug}`;
  }

  /** Copia la URL pública al portapapeles con feedback temporal en el botón. */
  copyStoreUrl(): void {
    if (!this.savedSlug) return;
    const url = this.getStoreUrl();

    const done = () => {
      this.slugCopied = true;
      setTimeout(() => (this.slugCopied = false), 2000);
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => this.fallbackCopy(url, done));
    } else {
      this.fallbackCopy(url, done);
    }
  }

  /** Genera el QR de la URL pública (librería cargada bajo demanda: solo la usa el admin). */
  async generateStoreQr(): Promise<void> {
    this.storeQrDataUrl = '';
    if (!this.savedSlug || typeof window === 'undefined') return;
    try {
      // CommonJS: con import() dinámico las funciones quedan en `default`
      const mod: any = await import('qrcode');
      const QRCode = mod.default ?? mod;
      this.storeQrDataUrl = await QRCode.toDataURL(this.getStoreUrl(), {
        width: 512,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    } catch {
      this.storeQrDataUrl = '';
    }
  }

  /** Copia la imagen del QR al portapapeles (para pegarla en WhatsApp, un documento, etc.). */
  async copyStoreQr(): Promise<void> {
    if (!this.storeQrDataUrl) return;
    this.qrCopyError = '';
    try {
      const ClipboardItemCtor = (window as any).ClipboardItem;
      if (!navigator.clipboard?.write || !ClipboardItemCtor) throw new Error('unsupported');
      const blob = await (await fetch(this.storeQrDataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
      this.qrCopied = true;
      setTimeout(() => (this.qrCopied = false), 2000);
    } catch {
      // Navegadores sin copia de imágenes (o sin HTTPS): se ofrece la descarga
      this.qrCopyError = 'Tu navegador no permite copiar imágenes; usa "Descargar".';
    }
  }

  downloadStoreQr(): void {
    if (!this.storeQrDataUrl || typeof document === 'undefined') return;
    const a = document.createElement('a');
    a.href = this.storeQrDataUrl;
    a.download = `qr-marketplace-${this.savedSlug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  private fallbackCopy(text: string, done: () => void): void {
    if (typeof document === 'undefined') return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      done();
    } catch {
      /* noop */
    }
    document.body.removeChild(ta);
  }

  onSlugInput(event: any): void {
    // Normalize as they type
    this.slugError = '';
    this.slugSuccess = '';
    let value = event.target.value || '';
    value = value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    this.marketplaceSlug = value;
  }

  saveSlug(): void {
    if (!this.marketplaceSlug || this.marketplaceSlug.length < 3) {
      this.slugError = 'El nombre debe tener al menos 3 caracteres';
      return;
    }

    this.slugSaving = true;
    this.slugError = '';
    this.slugSuccess = '';

    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    this.http.patch(`${this.baseUrl}/marketplace-config/${this.tenantId}/slug`, 
      { slug: this.marketplaceSlug },
      { headers: { Authorization: `Bearer ${token}` } }
    ).subscribe({
      next: (response: any) => {
        this.slugSaving = false;
        this.marketplaceSlug = response.slug;
        this.savedSlug = response.slug;
        this.generateStoreQr();
        this.slugSuccess = `✓ URL guardada: ${this.getBaseUrl()}/marketplace/${response.slug}`;
      },
      error: (err) => {
        this.slugSaving = false;
        this.slugError = err.error?.message || 'Error al guardar. Intenta con otro nombre.';
      }
    });
  }
}