import { Component, ElementRef, EventEmitter, HostListener, Input, Output, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomersService } from '../../../shared/services/customers.service';
import { TaxService, taxOn } from '../../../shared/services/tax.service';
import { ProductsService, SellableItem } from '../../../shared/services/products.service';
import { SalesService, CreateSaleDto } from '../../../shared/services/sales.service';
import { StockService } from '../../../shared/services/stock.service';
import { StockAlertsService } from '../../../shared/services/stock-alerts.service';
import { CompositionService } from '../../../shared/services/composition.service';
import { Customer } from '../../../shared/model/customer.model';
import { CreditService, CreditEligibility, PAYMENT_METHODS, PaymentType } from '../../../shared/services/credit.service';
import { PromotionsService } from '../../../shared/services/promotions.service';
import { ProfitBubbleService } from '../../../shared/services/profit-bubble.service';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { customerHint, leadToCustomer, mergeCustomers, promptQuickCustomer } from '../../../shared/utils/quick-customer';
import { localDay } from '../../../shared/utils/daily-sales-xlsx';
import Swal from 'sweetalert2';
import { BarcodeRow, BarcodesService, normalizeBarcode } from '../../../shared/services/barcodes.service';
import { BarcodeScanner } from '../../../shared/utils/barcode-scanner';
import { ReceiptService } from '../../../shared/services/receipt.service';

interface OrderItem {
  id: string;
  productId: string;
  itemType: SellableItem['itemType'];
  product: string;
  quantity: number;
  unitPrice: number;
  total: number;
  /** Precio normal, si se aplicó una promoción. */
  listPrice?: number;
  promotionName?: string;
}

interface OrderForm {
  customerName: string;
  /** userId del cliente en Authoriza (necesario para crédito). */
  customerId: string;
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
export class SaleFormComponent implements OnInit, OnDestroy {
  @Input() isModal = false;
  @Output() saleCreated = new EventEmitter<void>();
  @Output() formCancelled = new EventEmitter<void>();
  
  loading = false;
  showCustomerDropdown = false;

  /** Días hacia atrás que se puede fechar una venta (el backend valida lo mismo). */
  static readonly MAX_BACKDATE_DAYS = 60;
  /** Fecha de la venta (AAAA-MM-DD, día local): hoy, o un día anterior si se registra tarde. */
  saleDate = localDay(new Date());
  /** Hora que muestra la etiqueta de la fecha (la venta queda con la hora en que se registra). */
  now = new Date();
  private clock = setInterval(() => (this.now = new Date()), 30000);

  /** Etiqueta junto al cliente: «Hoy, 6 nov · 3:45 p. m.» o el día escogido. */
  get saleWhenLabel(): string {
    if (!this.saleDate) return 'Sin fecha';
    const [y, m, d] = this.saleDate.split('-').map(Number);
    const day = new Date(y, m - 1, d);
    const short = day.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
    if (!this.isBackdated) return `Hoy, ${short} · ${this.now.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`;
    return day.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: y === new Date().getFullYear() ? undefined : 'numeric' }).replace(/\./g, '');
  }

  /** Abre el calendario del campo de fecha (oculto detrás de la etiqueta). */
  openDatePicker(input: HTMLInputElement): void {
    try {
      (input as any).showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.clock);
  }
  get maxSaleDate(): string { return localDay(new Date()); }
  get minSaleDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - SaleFormComponent.MAX_BACKDATE_DAYS);
    return localDay(d);
  }
  /** La venta no es de hoy (se muestra un aviso). */
  get isBackdated(): boolean { return !!this.saleDate && this.saleDate < this.maxSaleDate; }
  get saleDateValid(): boolean { return !!this.saleDate && this.saleDate >= this.minSaleDate && this.saleDate <= this.maxSaleDate; }
  showProductDropdown = false;
  customerSearchTerm = '';
  productSearchTerm = '';
  
  // Forma de pago
  readonly paymentMethods = PAYMENT_METHODS;
  paymentType: PaymentType = 'CONTADO';
  paymentMethod = 'EFECTIVO';
  creditInfo: CreditEligibility | null = null;
  loadingCredit = false;

  orderData: OrderForm = {
    customerId: '',
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
    unitPrice: 0,
    listPrice: 0,
    promotionName: ''
  };

  customers: Customer[] = [];
  products: Product[] = [];
  filteredCustomers: Customer[] = [];
  filteredProducts: Product[] = [];

  constructor(private customersService: CustomersService, private productsService: ProductsService, private salesService: SalesService, private stockService: StockService, private compositionService: CompositionService, private stockAlertsService: StockAlertsService, private creditService: CreditService, private promotionsService: PromotionsService, private profitBubble: ProfitBubbleService, private taxService: TaxService, private barcodesService: BarcodesService, private host: ElementRef<HTMLElement>, public receipts: ReceiptService) {}

  /** IVA o INC del período activo del negocio; 0 si no está configurado. */
  taxLabel: 'IVA' | 'INC' = 'IVA';
  taxPercent = 0;

  /** Códigos de barras del negocio (código → ítem), para vender leyendo con el lector. */
  private barcodes = new Map<string, BarcodeRow>();
  private readonly scanner = new BarcodeScanner((code) => this.onScan(code));

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    // Solo con el formulario a la vista (en Comercial vive dentro de un modal
    // oculto) y sin otra ventana encima (los avisos tipo toast no cuentan)
    if (!this.host.nativeElement.getClientRects().length) return;
    if (document.querySelector('.swal2-popup:not(.swal2-toast):not(.swal2-hide)')) return;
    this.scanner.handle(event);
  }

  ngOnInit(): void {
    this.loadCustomers();
    this.loadProducts();
    this.loadBarcodes();
    // Impuesto del período activo (sin parámetro, ninguno)
    this.taxService.info().subscribe((t) => { this.taxLabel = t.label; this.taxPercent = t.percent; this.updateTotals(); });
  }

  loadCustomers(): void {
    // Con cuenta (clienteInout) + clientes rápidos (clientes potenciales del negocio)
    forkJoin([
      this.customersService.getCustomers().pipe(catchError((error) => { console.error('Error loading customers:', error); return of([]); })),
      this.customersService.getPotentialCustomers().pipe(catchError(() => of([]))),
    ]).subscribe(([clients, leads]) => {
      this.customers = mergeCustomers(clients, leads);
      this.filterCustomers();
    });
  }

  customerHint = customerHint;

  /** Registra un cliente con solo el nombre (teléfono y correo opcionales) y lo deja seleccionado. */
  async createQuickCustomer(): Promise<void> {
    this.showCustomerDropdown = false;
    const data = await promptQuickCustomer(this.customerSearchTerm.trim());
    if (!data) return;
    this.customersService.createQuickCustomer(data).subscribe({
      next: (lead) => {
        const customer = leadToCustomer(lead);
        this.customers = [...this.customers.filter((c) => c.potentialUserId !== customer.potentialUserId || !!c.id), customer];
        this.selectCustomer(customer);
        Swal.fire({ icon: 'success', title: 'Cliente registrado', text: data.name, timer: 1300, showConfirmButton: false, toast: true, position: 'top-end' });
      },
      error: (err) => Swal.fire('No se pudo registrar el cliente', err?.error?.message || 'Intenta de nuevo.', 'error'),
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
    if (this.orderData.customerId && this.customerSearchTerm !== this.orderData.customerName) {
      this.orderData.customerId = '';
      this.creditInfo = null;
      this.paymentType = 'CONTADO';
    }
    const query = this.customerSearchTerm.toLowerCase();
    if (query) {
      this.filteredCustomers = this.customers.filter(customer => {
        const displayName = this.getCustomerDisplayName(customer).toLowerCase();
        return displayName.includes(query) || customer.email?.toLowerCase().includes(query) || (customer.phone || '').includes(query);
      });
    } else {
      this.filteredCustomers = this.customers;
    }
  }

  filterProducts(): void {
    const query = this.productSearchTerm.toLowerCase();
    if (query) {
      const byCode = this.barcodes.get(this.productSearchTerm.trim())?.itemId;
      this.filteredProducts = this.products.filter(product =>
        product.name.toLowerCase().includes(query) || !!product.brand?.toLowerCase().includes(query) || product.id === byCode
      );
    } else {
      this.filteredProducts = this.products;
    }
  }

  selectCustomer(customer: Customer): void {
    this.orderData.customerName = this.getCustomerDisplayName(customer);
    this.orderData.customerId = customer.id || '';
    this.customerSearchTerm = this.orderData.customerName;
    this.showCustomerDropdown = false;
    this.loadCreditInfo();
  }

  /** Crédito del cliente seleccionado: cupo, disponible, plazo y si puede comprar a crédito. */
  private loadCreditInfo(): void {
    this.creditInfo = null;
    if (!this.orderData.customerId) {
      this.paymentType = 'CONTADO';
      return;
    }
    this.loadingCredit = true;
    this.creditService.eligibility(this.orderData.customerId).subscribe({
      next: (info) => {
        this.creditInfo = info;
        this.loadingCredit = false;
        if (!info.eligible && this.paymentType === 'CREDITO') this.paymentType = 'CONTADO';
      },
      error: () => {
        this.loadingCredit = false;
        this.paymentType = 'CONTADO';
      },
    });
  }

  setPaymentType(type: PaymentType): void {
    if (type === 'CREDITO' && !this.canUseCredit) return;
    this.paymentType = type;
  }

  /** ¿El cliente seleccionado puede comprar a crédito (sin mirar el total)? */
  get canUseCredit(): boolean {
    return !!this.orderData.customerId && !!this.creditInfo?.eligible;
  }

  /** Motivo por el que no se puede vender a crédito (para mostrarlo). */
  get creditBlockReason(): string | null {
    if (!this.orderData.customerId) return 'Selecciona un cliente registrado para vender a crédito.';
    if (this.loadingCredit) return null;
    if (this.creditInfo && !this.creditInfo.eligible) return this.creditInfo.reason;
    return null;
  }

  /** A crédito, el total no puede superar el cupo disponible. */
  get exceedsCredit(): boolean {
    return this.paymentType === 'CREDITO' && !!this.creditInfo && this.orderData.total > this.creditInfo.available + 0.005;
  }

  /** Fecha de vencimiento según la condición de pago del cliente. */
  get creditDueDate(): Date | null {
    if (!this.creditInfo?.termDays) return null;
    // Desde la fecha de la venta (el backend calcula igual)
    const [y, m, day] = (this.saleDate || this.maxSaleDate).split('-').map(Number);
    const d = new Date(y, m - 1, day);
    d.setDate(d.getDate() + this.creditInfo.termDays);
    return d;
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
    this.applyPromotionPrice(product);
  }

  /**
   * Precio con la mejor promoción vigente en la tienda. Si el usuario cambia
   * el precio después, se respeta (y el backend no marca la promoción).
   */
  private applyPromotionPrice(product: Product): void {
    this.currentItem.listPrice = product.price || 0;
    this.currentItem.promotionName = '';
    const requestedId = product.id;
    this.promotionsService.quote([{ productId: product.id, itemType: product.itemType, quantity: 1 }]).subscribe({
      next: (q) => {
        const line = q.items?.[0];
        // Solo si sigue seleccionado el mismo ítem
        if (!line || this.currentItem.productId !== requestedId) return;
        this.currentItem.listPrice = line.listPrice;
        if (line.promotion) {
          this.currentItem.unitPrice = line.unitPrice;
          this.currentItem.promotionName = line.promotion.name;
        }
      },
      error: () => { /* sin promociones: queda el precio normal */ },
    });
  }

  /** La promoción solo vale si se cobra su precio. */
  private promotionStillApplies(): boolean {
    return !!this.currentItem.promotionName && this.currentItem.unitPrice < this.currentItem.listPrice;
  }

  itemTypeLabel(product: Product): string {
    return product.itemType === 'combo' ? 'Combo' : product.itemType === 'kit' ? 'Kit' : '';
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
      total: this.currentItem.quantity * this.currentItem.unitPrice,
      ...(this.promotionStillApplies() ? { listPrice: this.currentItem.listPrice, promotionName: this.currentItem.promotionName } : {})
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
    this.orderData.tax = taxOn(this.orderData.subtotal, this.taxPercent);
    this.orderData.total = this.orderData.subtotal + this.orderData.tax;
  }

  // ── Lector de códigos de barras ─────────────────────────────────────

  loadBarcodes(): void {
    this.barcodesService.getAll().subscribe({
      next: (rows) => (this.barcodes = new Map(rows.map((r) => [r.code, r]))),
      error: () => { /* sin códigos: se vende buscando por nombre */ },
    });
  }

  /** Enter en el buscador: si lo escrito es un código de barras, se agrega. */
  onProductSearchEnter(event: Event): void {
    const code = normalizeBarcode(this.productSearchTerm);
    if (!code || !/\d/.test(code)) return;
    if (!this.barcodes.has(code) && this.filteredProducts.length) return;
    event.preventDefault();
    this.productSearchTerm = '';
    this.filterProducts();
    this.onScan(code);
  }

  /** Lectura del lector: agrega el ítem a la venta (o suma uno si ya está). */
  onScan(raw: string): void {
    const code = normalizeBarcode(raw);
    if (!code || this.loading) return;
    const known = this.barcodes.get(code);
    if (known) {
      this.addScannedItem(known.itemId, code);
      return;
    }
    // Puede ser un código asignado después de abrir la venta
    this.barcodesService.lookup(code).subscribe({
      next: (row) => {
        this.barcodes.set(row.code, row);
        this.addScannedItem(row.itemId, code, row.itemName);
      },
      error: (err) => {
        if (err?.status === 404) this.offerAssign(code);
        else this.scanFeedback(false, 'No se pudo revisar el código', 'Revisa tu conexión e intenta de nuevo.');
      },
    });
  }

  private addScannedItem(itemId: string, code: string, itemName?: string): void {
    const product = this.products.find((p) => p.id === itemId);
    if (!product) {
      this.scanFeedback(false, 'No disponible para la venta', `${itemName ? `«${itemName}»` : `El código ${code}`} no está activo o no tiene precio de venta.`);
      return;
    }
    if (product.stock <= 0) {
      this.scanFeedback(false, 'Sin stock', `«${product.name}» no tiene stock disponible.`);
      return;
    }
    if (this.quantityInCart(product.id) + 1 > product.stock) {
      this.scanFeedback(false, 'Stock insuficiente', `De «${product.name}» solo hay ${product.stock} disponible(s) y ya están en la venta.`);
      return;
    }
    const line = this.orderData.items.find((i) => i.productId === product.id);
    if (line) {
      line.quantity = Number(line.quantity) + 1;
      line.total = line.quantity * line.unitPrice;
      this.updateTotals();
      this.scanFeedback(true, `${product.name} × ${line.quantity}`);
      return;
    }
    const push = (unitPrice: number, listPrice?: number, promotionName?: string) => {
      // Si mientras tanto llegó otra lectura del mismo ítem, se suma a esa línea
      const again = this.orderData.items.find((i) => i.productId === product.id);
      if (again) {
        if (this.quantityInCart(product.id) + 1 > product.stock) return;
        again.quantity = Number(again.quantity) + 1;
        again.total = again.quantity * again.unitPrice;
      } else {
        this.orderData.items.push({
          id: `${Date.now()}-${product.id}`,
          productId: product.id,
          itemType: product.itemType,
          product: product.name,
          quantity: 1,
          unitPrice,
          total: unitPrice,
          ...(promotionName && listPrice && unitPrice < listPrice ? { listPrice, promotionName } : {}),
        });
      }
      this.updateTotals();
      this.scanFeedback(true, product.name);
    };
    this.promotionsService.quote([{ productId: product.id, itemType: product.itemType, quantity: 1 }]).subscribe({
      next: (q) => {
        const p = q.items?.[0];
        if (p?.promotion) push(p.unitPrice, p.listPrice, p.promotion.name);
        else push(product.price || 0);
      },
      error: () => push(product.price || 0),
    });
  }

  /** Código que no es de nadie: ofrece asignarlo a un ítem y lo agrega a la venta. */
  private async offerAssign(code: string): Promise<void> {
    this.beep(false);
    const options: Record<string, string> = {};
    [...this.products].sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach((p) => (options[p.id] = p.name));
    const { value: itemId } = await Swal.fire({
      icon: 'question',
      title: 'Código sin asignar',
      html: `El código <b>${code}</b> no es de ningún producto. Si quieres, asígnalo ahora: la próxima vez se agrega solo.`,
      input: 'select',
      inputOptions: options,
      inputPlaceholder: 'Escoge el producto',
      showCancelButton: true,
      confirmButtonText: 'Asignar y agregar',
      cancelButtonText: 'Cancelar',
      inputValidator: (v) => (v ? null : 'Escoge el producto.'),
    });
    if (!itemId) return;
    const product = this.products.find((p) => p.id === itemId);
    if (!product) return;
    const itemType = product.itemType === 'kit' ? 'combo' : product.itemType;
    this.barcodesService.forItem(itemType, product.id).pipe(
      switchMap((codes) => this.barcodesService.set(itemType, product.id, [...codes, code])),
    ).subscribe({
      next: () => {
        this.barcodes.set(code, { code, itemType, itemId: product.id });
        this.addScannedItem(product.id, code);
      },
      error: (err) => Swal.fire('No se pudo asignar el código', typeof err?.error?.message === 'string' ? err.error.message : 'Intenta de nuevo.', 'error'),
    });
  }

  /** Aviso corto (sin interrumpir la caja) y un pitido distinto si algo falló. */
  private scanFeedback(ok: boolean, title: string, text?: string): void {
    this.beep(ok);
    Swal.fire({
      toast: true, position: 'top-end', showConfirmButton: false, timer: ok ? 1300 : 3500, timerProgressBar: !ok,
      icon: ok ? 'success' : 'warning', title, text,
    });
  }

  private audio?: AudioContext;
  private beep(ok: boolean): void {
    try {
      this.audio = this.audio || new AudioContext();
      const osc = this.audio.createOscillator(), gain = this.audio.createGain();
      osc.frequency.value = ok ? 1200 : 300;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(this.audio.destination);
      osc.start();
      osc.stop(this.audio.currentTime + (ok ? 0.08 : 0.25));
    } catch { /* sin sonido */ }
  }

  resetCurrentItem(): void {
    this.currentItem = {
      productId: '',
      product: '',
      quantity: 1,
      unitPrice: 0,
      listPrice: 0,
      promotionName: ''
    };
  }

  canSubmit(): boolean {
    if (!(this.orderData.customerName && this.orderData.items.length > 0)) return false;
    if (!this.saleDateValid) return false;
    if (this.paymentType === 'CREDITO') return this.canUseCredit && !this.exceedsCredit;
    return !!this.paymentMethod;
  }

  onSubmit(): void {
    if (!this.canSubmit() || this.loading) return;

    this.loading = true;
    
    const saleData: CreateSaleDto = {
      strTenantId: 'default-tenant',
      strProductId: this.orderData.items[0]?.productId,
      // Día local: toISOString() daba el día UTC (en la noche de Colombia, mañana)
      dtmDate: this.saleDate,
      fltQuantity: Number(this.orderData.items[0]?.quantity) || 0,
      fltUnitPrice: Number(this.orderData.items[0]?.unitPrice) || 0,
      customerName: this.orderData.customerName,
      customerId: this.orderData.customerId || undefined,
      paymentType: this.paymentType,
      paymentMethod: this.paymentType === 'CONTADO' ? this.paymentMethod : undefined,
      // productId por ítem: el backend valida y descuenta stock de TODOS
      items: this.orderData.items.map(i => ({ ...i, productName: i.product })),
      subtotal: Number(this.orderData.subtotal),
      tax: Number(this.orderData.tax),
      total: Number(this.orderData.total)
    };
    
    this.salesService.createSale(saleData).subscribe({
      next: (response) => {
        console.log('Sale created:', response);
        // Tiquete para la tiquetera (si está activado en este equipo)
        const sale = (response as any)?.sale;
        if (sale && this.receipts.settings.autoPrint) this.receipts.print(sale).catch(() => {});
        // Burbuja con la ganancia de esta venta (con sonido)
        this.profitBubble.show((response as any)?.profit, `la venta ${(response as any)?.sale?.strInvoiceCode || ''}`.trim());
        
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
    this.paymentType = 'CONTADO';
    this.paymentMethod = 'EFECTIVO';
    this.creditInfo = null;
    this.saleDate = localDay(new Date());
    this.orderData = {
      customerId: '',
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
}
