import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomersService } from '../../../shared/services/customers.service';
import { ProductsService, SellableItem } from '../../../shared/services/products.service';
import { Customer } from '../../../shared/model/customer.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import Swal from 'sweetalert2';
import { formatCop } from '../../../shared/utils/currency.util';
import { PromotionsService } from '../../../shared/services/promotions.service';

interface OrderItem {
  productId: string;
  productName: string;
  itemType: SellableItem['itemType'];
  quantity: number;
  unitPrice: number;
  subtotal: number;
  /** Precio normal, si se aplicó una promoción. */
  listPrice?: number;
  promotionName?: string;
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

type Product = SellableItem;

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
    itemType: 'product' as SellableItem['itemType'],
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

  private baseUrl = `${environment.apiUrl}/orders`;

  // ─── Entrega: lo antes posible o programada (misma lógica de franjas del MarketPlace) ───
  deliveryMode: 'ASAP' | 'SCHEDULED' = 'ASAP';
  scheduleDate = '';
  /** null = no se sabe aún; false = la tienda no tiene programación → hora libre. */
  schedulingEnabled: boolean | null = null;
  scheduleSlots: { start: string; end: string; available: boolean; remaining: number | null; reason?: string }[] = [];
  slotsLoading = false;
  scheduledStart: string | null = null;
  /** Hora libre cuando la tienda no tiene programación (datetime-local). */
  freeDateTime = '';
  /** El negocio eligió una franja llena o fuera de tiempos (queda como excepción). */
  allowSlotOverride = false;
  todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

  constructor(
    private customersService: CustomersService,
    private productsService: ProductsService,
    private http: HttpClient,
    private promotionsService: PromotionsService
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
    // Productos + materiales de reventa, con stock DISPONIBLE (descontando
    // lo reservado por otros pedidos confirmados): es lo que el backend exige
    // al confirmar.
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
    this.currentItem.itemType = product.itemType;
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

  addItem(): void {
    if (!this.canAddItem()) return;

    // Un borrador sin stock se permite (sirve como cotización), pero no se
    // podrá confirmar hasta que haya stock disponible: se advierte aquí.
    const product = this.products.find(p => p.id === this.currentItem.productId);
    if (product) {
      const inCart = this.orderData.items
        .filter(i => i.productId === product.id)
        .reduce((sum, i) => sum + Number(i.quantity || 0), 0);
      const requested = inCart + Number(this.currentItem.quantity);
      if (requested > product.stock) {
        Swal.fire({
          icon: 'warning',
          title: 'Stock insuficiente',
          html: `<b>${product.name}</b><br>Disponible: ${product.stock} — solicitado: ${requested}.` +
            `<br>El pedido se guardará como <b>borrador</b>, pero no podrá confirmarse hasta que haya stock.`,
          confirmButtonText: 'Entendido'
        });
      }
    }

    const item: OrderItem = {
      productId: this.currentItem.productId,
      itemType: this.currentItem.itemType,
      productName: this.currentItem.product,
      quantity: this.currentItem.quantity,
      unitPrice: this.currentItem.unitPrice,
      subtotal: this.currentItem.quantity * this.currentItem.unitPrice,
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

  setDeliveryMode(mode: 'ASAP' | 'SCHEDULED'): void {
    this.deliveryMode = mode;
    if (mode === 'SCHEDULED' && !this.scheduleDate) this.loadSlots(this.todayIso);
  }

  /** Franjas del día para los productos del pedido (considera la cola y la fabricación). */
  loadSlots(date: string, keepSelection = false): void {
    const previous = keepSelection ? this.scheduledStart : null;
    this.scheduleDate = date;
    this.scheduledStart = null;
    this.allowSlotOverride = false;
    this.scheduleSlots = [];
    if (!date) return;
    this.slotsLoading = true;
    this.http.post<any>(`${this.baseUrl}/slots`, { date, items: this.orderData.items }).subscribe({
      next: (res) => {
        this.slotsLoading = false;
        this.schedulingEnabled = !!res?.enabled;
        this.scheduleSlots = res?.slots || [];
        if (previous && this.scheduleSlots.some((s) => s.start === previous && s.available)) this.scheduledStart = previous;
      },
      error: () => { this.slotsLoading = false; this.schedulingEnabled = false; },
    });
  }

  /** Elegir franja. Una no disponible se puede tomar como excepción, confirmándolo. */
  pickSlot(slot: { start: string; available: boolean; reason?: string }): void {
    if (slot.available) {
      this.scheduledStart = slot.start;
      this.allowSlotOverride = false;
      return;
    }
    Swal.fire({
      icon: 'warning',
      title: 'Franja no disponible',
      text: `${this.slotReason(slot.reason)}. ¿Programar el pedido en esta franja de todos modos?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, programar',
      cancelButtonText: 'Elegir otra',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.scheduledStart = slot.start;
      this.allowSlotOverride = true;
    });
  }

  slotLabel(slot: { start: string; end: string }): string {
    const f = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    return `${f(slot.start)} – ${f(slot.end)}`;
  }

  slotReason(reason?: string): string {
    const m: Record<string, string> = {
      PASADA: 'La franja ya pasó',
      ANTICIPACION: 'No cumple la anticipación mínima',
      PREPARACION: 'El pedido no alcanza a estar listo (cola / fabricación)',
      LLENA: 'La franja está llena',
    };
    return reason ? m[reason] || 'No disponible' : '';
  }

  trackByStart = (_: number, s: { start: string }) => s.start;

  updateTotals(): void {
    // Las franjas dependen de los productos (fabricación): se recalculan
    if (this.deliveryMode === 'SCHEDULED' && this.schedulingEnabled && this.scheduleDate) {
      this.loadSlots(this.scheduleDate, true);
    }
    this.orderData.subtotal = this.orderData.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.orderData.tax = this.orderData.subtotal * 0.19;
    this.orderData.discount = 0;
    this.orderData.total = this.orderData.subtotal + this.orderData.tax - this.orderData.discount;
  }

  resetCurrentItem(): void {
    this.currentItem = { productId: '', itemType: 'product', product: '', quantity: 1, unitPrice: 0, listPrice: 0, promotionName: '' };
    this.productSearchTerm = '';
  }

  canSubmit(): boolean {
    return !!(this.orderData.customerName && this.orderData.items.length > 0);
  }

  /** Inicio programado que se enviará (franja o, sin programación en la tienda, hora libre). */
  private get scheduledPayload(): string | null {
    if (this.deliveryMode !== 'SCHEDULED') return null;
    if (this.schedulingEnabled === false) return this.freeDateTime ? new Date(this.freeDateTime).toISOString() : null;
    return this.scheduledStart;
  }

  onSubmit(): void {
    if (!this.canSubmit() || this.loading) return;
    if (this.deliveryMode === 'SCHEDULED' && !this.scheduledPayload) {
      Swal.fire({ icon: 'warning', title: 'Programación', text: 'Elige el día y la franja de entrega, o marca "Lo antes posible".' });
      return;
    }

    this.loading = true;

    const payload = {
      customerId: this.orderData.customerId || null,
      customerName: this.orderData.customerName,
      items: this.orderData.items,
      notes: this.orderData.notes || null,
      deliveryDate: this.orderData.deliveryDate || null,
      ...(this.scheduledPayload ? { scheduledStart: this.scheduledPayload, allowSlotOverride: this.allowSlotOverride } : {}),
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
        Swal.fire({ icon: 'error', title: 'Error', text: errorMessage, confirmButtonText: 'Cerrar' });
      }
    });
  }

  onCancel(): void {
    this.resetForm();
    this.formCancelled.emit();
  }

  /** Formato de pesos de los pedidos: "$2.362.200". */
  formatCurrency(amount: number): string {
    return formatCop(amount);
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
    this.deliveryMode = 'ASAP';
    this.scheduleDate = '';
    this.scheduleSlots = [];
    this.scheduledStart = null;
    this.freeDateTime = '';
    this.allowSlotOverride = false;
  }
}
