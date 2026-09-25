import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';
import { OrderFormComponent } from './form/order-form.component';
import { InvoiceService } from '../../shared/services/invoice.service';
import { DocumentsService } from '../../shared/services/documents.service';
import { StockAlertsService } from '../../shared/services/stock-alerts.service';
import { UiPrefsService } from '../../shared/services/ui-prefs/ui-prefs.service';
import { DeliveryLauncherService } from '../../shared/services/delivery-launcher.service';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Order {
  id: string;
  tenantId: string;
  orderCode: string;
  customerId: string | null;
  customerName: string;
  status: string;
  items: OrderItem[];
  notes: string;
  deliveryDate: string;
  cancellationReason?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  deliveryLatitude?: number | string | null;
  deliveryLongitude?: number | string | null;
  cancelledAt?: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}

interface OrderStats {
  total: number;
  DRAFT: number;
  CONFIRMED: number;
  IN_PRODUCTION: number;
  READY: number;
  DELIVERED: number;
  INVOICED: number;
  CANCELLED: number;
}

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderFormComponent],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css'],
})
export class OrdersComponent implements OnInit {
  activeTab: 'panel' | 'list' | 'kanban' = 'panel';
  orders: Order[] = [];
  stats: OrderStats = { total: 0, DRAFT: 0, CONFIRMED: 0, IN_PRODUCTION: 0, READY: 0, DELIVERED: 0, INVOICED: 0, CANCELLED: 0 };
  loading = true;
  selectedOrder: Order | null = null;
  showCreateModal = false;
  filterStatus = 'all';

  private baseUrl = `${environment.apiUrl}/orders`;

  constructor(
    private http: HttpClient,
    private invoiceService: InvoiceService,
    private documentsService: DocumentsService,
    private stockAlertsService: StockAlertsService,
    private uiPrefs: UiPrefsService,
    private deliveryLauncher: DeliveryLauncherService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
    this.loadStats();
  }

  loadOrders(): void {
    this.loading = true;
    this.http.get<{ data: Order[] }>(this.baseUrl).subscribe({
      next: (res) => {
        this.orders = res.data || [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  loadStats(): void {
    this.http.get<OrderStats>(`${this.baseUrl}/stats`).subscribe({
      next: (stats) => { this.stats = stats; },
      error: () => {}
    });
  }

  get filteredOrders(): Order[] {
    if (this.filterStatus === 'all') return this.orders;
    return this.orders.filter(o => o.status === this.filterStatus);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: 'Borrador', CONFIRMED: 'Confirmado', IN_PRODUCTION: 'En Producción',
      READY: 'Listo', DELIVERED: 'Entregado', INVOICED: 'Facturado', CANCELLED: 'Cancelado'
    };
    return labels[status] || status;
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      DRAFT: '#6b7280', CONFIRMED: '#2563eb', IN_PRODUCTION: '#d97706',
      READY: '#16a34a', DELIVERED: '#0d9488', INVOICED: '#7c3aed', CANCELLED: '#dc2626'
    };
    return colors[status] || '#6b7280';
  }

  getNextStatus(status: string): string | null {
    const flow: Record<string, string> = {
      DRAFT: 'CONFIRMED', CONFIRMED: 'IN_PRODUCTION', IN_PRODUCTION: 'READY',
      READY: 'DELIVERED', DELIVERED: 'INVOICED'
    };
    return flow[status] || null;
  }

  advanceStatus(order: Order): void {
    const next = this.getNextStatus(order.status);
    if (!next) return;

    // Al pasar a Entregado (última columna del tablero), sugerir contratar
    // el domicilio con la extensión de Shotra (configurable en Configuración).
    if (next === 'DELIVERED' && this.uiPrefs.getSuggestDeliveryOnDeliver()) {
      this.suggestShotraDelivery(order, next);
      return;
    }
    this.applyStatus(order, next);
  }

  /** Sugerencia de Shotra con instrucciones y "No volver a mostrar". */
  private suggestShotraDelivery(order: Order, next: string): void {
    let dontShowAgain = false;
    const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
    )[c]);
    const icon = (name: string) =>
      `<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><use xlink:href="./assets/icons/bootstrap-icons.svg#${name}"></use></svg>`;
    const itemsCount = (order.items || []).reduce((n, i) => n + Number(i.quantity || 0), 0);
    const steps = [
      { icon: 'truck', title: 'Pide el domicilio', text: 'Se abre Shotra con la solicitud ya diligenciada con los datos de este pedido.' },
      { icon: 'geo-alt-fill', title: 'Marca la recogida', text: 'Elige el tipo de entrega y marca 📍 tu ubicación como punto de recogida.' },
      { icon: 'megaphone', title: 'Publica', text: 'Los domiciliarios cercanos te envían sus ofertas.' },
      { icon: 'chat-dots', title: 'Acepta y coordina', text: 'Acepta la oferta que prefieras y coordina por el chat.' },
      { icon: 'check2-circle', title: 'Cierra la entrega', text: 'Cierra el trabajo en Shotra y marca aquí el pedido como Entregado.' },
    ];

    Swal.fire({
      width: 620,
      showCloseButton: true,
      customClass: {
        popup: 'shotra-suggest-popup',
        actions: 'shotra-suggest-actions',
        confirmButton: 'shotra-btn shotra-btn-primary',
        denyButton: 'shotra-btn shotra-btn-secondary',
        cancelButton: 'shotra-btn shotra-btn-ghost',
      },
      buttonsStyling: false,
      html: `
        <div class="shotra-suggest">
          <div class="ss-header">
            <img src="assets/img/logo_shotra.png" alt="Shotra" class="ss-logo">
            <div>
              <h3 class="ss-title">¿Necesitas un domiciliario?</h3>
              <p class="ss-subtitle">Contrata la entrega con <strong>Domicilios (Shotra)</strong> sin salir de InOut.</p>
            </div>
          </div>

          <div class="ss-order">
            <div class="ss-order-code">${icon('box-seam')} <span>${esc(order.orderCode)}</span></div>
            <div class="ss-order-grid">
              <div><span class="ss-label">${icon('person-fill')} Cliente</span><span class="ss-value">${esc(order.customerName || 'Sin nombre')}</span></div>
              <div><span class="ss-label">${icon('cash-coin')} Valor</span><span class="ss-value">${esc(this.formatCurrency(order.total))}</span></div>
              <div><span class="ss-label">${icon('tag-fill')} Productos</span><span class="ss-value">${itemsCount} und.</span></div>
              <div class="ss-wide"><span class="ss-label">${icon('geo-alt-fill')} Entrega</span><span class="ss-value">${order.customerAddress ? esc(order.customerAddress) : '<em>Sin dirección: el domiciliario la coordina con el cliente</em>'}</span></div>
            </div>
          </div>

          <p class="ss-section">Cómo funciona</p>
          <ol class="ss-steps">
            ${steps.map((st, i) => `
              <li class="ss-step">
                <span class="ss-step-num">${i + 1}</span>
                <span class="ss-step-icon">${icon(st.icon)}</span>
                <span class="ss-step-text"><strong>${st.title}</strong>${st.text}</span>
              </li>`).join('')}
          </ol>

          <p class="ss-tip">${icon('truck')}<span>También puedes abrir Shotra cuando quieras con el botón <strong>Domicilios</strong>, abajo a la derecha.</span></p>

          <label class="ss-dont-show">
            <input type="checkbox" id="swal-dont-show-delivery">
            <span>No volver a mostrar esta sugerencia <em>(se reactiva en Configuración)</em></span>
          </label>
        </div>`,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '🛵 Pedir domicilio con Shotra',
      denyButtonText: '✓ Ya se entregó',
      cancelButtonText: 'Cancelar',
      willClose: () => {
        const box = document.getElementById('swal-dont-show-delivery') as HTMLInputElement | null;
        dontShowAgain = !!box?.checked;
      },
    }).then((result) => {
      if (dontShowAgain) this.uiPrefs.setSuggestDeliveryOnDeliver(false);

      if (result.isConfirmed) {
        // El pedido sigue en Listo hasta que realmente se entregue.
        this.selectedOrder = null;
        this.deliveryLauncher.openNewRequest(this.buildDeliveryPrefill(order));
      } else if (result.isDenied) {
        this.applyStatus(order, next);
      }
    });
  }

  /** Solicitud de domicilio precargada con los datos del pedido. */
  private buildDeliveryPrefill(order: Order) {
    const items = (order.items || []).map((i) => `${i.quantity} x ${i.productName}`).join(', ');
    const map = this.deliveryMapsLink(order);
    const lines = [
      `Entrega del pedido ${order.orderCode}.`,
      `Cliente: ${order.customerName || 'Sin nombre'}${order.customerPhone ? ` · Tel. ${order.customerPhone}` : ''}.`,
      items ? `Productos: ${items}.` : '',
      `Valor del pedido: ${this.formatCurrency(order.total)} (pago contra entrega).`,
      order.customerAddress ? `Dirección: ${order.customerAddress}.` : '',
      map ? `Ubicación exacta del cliente: ${map}` : '',
      order.notes ? `Notas del cliente: ${order.notes}` : '',
    ].filter(Boolean);
    return {
      title: `Entregar pedido ${order.orderCode}`,
      description: lines.join('\n'),
      address: order.customerAddress || undefined,
    };
  }

  private applyStatus(order: Order, next: string): void {
    this.http.patch<any>(`${this.baseUrl}/${order.id}/status`, { status: next }).subscribe({
      next: () => {
        Swal.fire({ icon: 'success', title: 'Estado actualizado', text: `Pedido avanzó a: ${this.getStatusLabel(next)}`, timer: 1500, showConfirmButton: false });
        this.loadOrders();
        this.loadStats();
        // Entregar un pedido descuenta stock real del producto: refrescar
        // el badge de alertas (sidebar) sin esperar a recargar la página.
        this.stockAlertsService.refreshAlerts();
      },
      error: (err) => {
        const msg = err.error?.message || 'No se pudo actualizar el estado';
        // Al confirmar, el backend rechaza si no hay stock disponible y lista
        // cada producto con su disponible/solicitado.
        const sinStock = msg.includes('insuficiente');
        Swal.fire({
          icon: sinStock ? 'warning' : 'error',
          title: sinStock ? 'No se puede confirmar: stock insuficiente' : 'Error',
          text: msg,
        });
      }
    });
  }

  /** Enlace a Google Maps con la ubicación exacta que capturó el comprador. */
  deliveryMapsLink(order: Order): string | null {
    const lat = Number(order.deliveryLatitude);
    const lng = Number(order.deliveryLongitude);
    if (order.deliveryLatitude == null || order.deliveryLongitude == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  canCancel(order: Order): boolean {
    return order.status !== 'INVOICED' && order.status !== 'CANCELLED';
  }

  /** Cancela con confirmación y motivo obligatorio (queda guardado en el pedido). */
  cancelOrder(order: Order): void {
    const stockNote = order.status === 'DELIVERED'
      ? 'El stock entregado se devolverá al inventario.'
      : order.status !== 'DRAFT'
        ? 'Se liberará el stock reservado por este pedido.'
        : '';

    Swal.fire({
      title: `¿Cancelar pedido ${order.orderCode}?`,
      html: `Cliente: <b>${order.customerName || 'Sin cliente'}</b><br>Esta acción no se puede deshacer.` +
        (stockNote ? `<br><small>${stockNote}</small>` : ''),
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Motivo de la cancelación',
      inputPlaceholder: 'Ej.: el cliente desistió de la compra',
      inputAttributes: { maxlength: '500' },
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar pedido',
      cancelButtonText: 'No, volver',
      confirmButtonColor: '#dc3545',
      inputValidator: (value) => {
        const reason = (value || '').trim();
        if (reason.length < 5) return 'Escribe el motivo de la cancelación (mínimo 5 caracteres)';
        return null;
      }
    }).then((result) => {
      if (!result.isConfirmed) return;
      const reason = String(result.value || '').trim();
      this.http.patch<any>(`${this.baseUrl}/${order.id}/status`, { status: 'CANCELLED', reason }).subscribe({
        next: () => {
          Swal.fire({ icon: 'success', title: 'Pedido cancelado', text: `${order.orderCode} fue cancelado.`, timer: 1500, showConfirmButton: false });
          if (this.selectedOrder?.id === order.id) this.selectedOrder = null;
          this.loadOrders();
          this.loadStats();
          this.stockAlertsService.refreshAlerts();
        },
        error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo cancelar', 'error'); }
      });
    });
  }

  deleteOrder(order: Order): void {
    Swal.fire({
      title: '¿Eliminar pedido?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      confirmButtonColor: '#dc2626'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${this.baseUrl}/${order.id}`).subscribe({
          next: () => { this.loadOrders(); this.loadStats(); },
          error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo eliminar', 'error'); }
        });
      }
    });
  }

  selectOrder(order: Order): void {
    this.selectedOrder = order;
  }

  viewOrder(order: Order): void {
    this.selectedOrder = order;
  }

  closeOrderDetail(): void {
    this.selectedOrder = null;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
  }

  formatDate(date: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Kanban helpers
  getOrdersByStatus(status: string): Order[] {
    return this.orders.filter(o => o.status === status);
  }

  getCompletedOrders(): Order[] {
    return this.orders.filter(o => o.status === 'INVOICED' || o.status === 'CANCELLED');
  }

  kanbanStatuses = ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED'];
  showHistory = true;
  showKanban = true;

  // Modal methods
  openCreateModal(): void {
    this.showCreateModal = true;
  }

  onOrderCreated(): void {
    this.showCreateModal = false;
    this.loadOrders();
    this.loadStats();
    Swal.fire({ icon: 'success', title: 'Pedido creado', text: 'El pedido se ha creado exitosamente', timer: 1500, showConfirmButton: false });
  }

  onFormCancelled(): void {
    this.showCreateModal = false;
  }

  // PDF Invoice generation
  generateInvoicePdf(order: Order): void {
    if (!order.items || order.items.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Sin items', text: 'El pedido no tiene items para facturar' });
      return;
    }
    this.invoiceService.generateOrderInvoice(order);
    Swal.fire({ icon: 'success', title: 'PDF Generado', text: `Factura del pedido ${order.orderCode} descargada`, timer: 1500, showConfirmButton: false });
  }

  // Comanda / Orden de pedido para producción
  generateOrderTicket(order: Order): void {
    this.documentsService.generateOrderTicket({
      orderCode: order.orderCode,
      customerName: order.customerName || 'Sin cliente',
      date: order.createdAt,
      deliveryDate: order.deliveryDate,
      items: (order.items || []).map(item => ({ productName: item.productName, quantity: item.quantity })),
      notes: order.notes,
      status: this.getStatusLabel(order.status)
    });
  }

  // Remisión / Nota de entrega
  generateDeliveryNote(order: Order): void {
    this.documentsService.generateDeliveryNote({
      orderCode: order.orderCode,
      customerName: order.customerName || 'Sin cliente',
      date: new Date().toISOString(),
      items: (order.items || []).map(item => ({ productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal })),
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total
    });
  }

  // Cotización (pedido en borrador)
  generateQuote(order: Order): void {
    // Obtener días de vigencia del parámetro configurado
    this.http.get<any>(`${environment.apiUrl}/business-params`).subscribe({
      next: (params) => {
        const days = params.DIAS_VIGENCIA_COTIZACION || 15;
        this.buildAndGenerateQuote(order, days);
      },
      error: () => {
        this.buildAndGenerateQuote(order, 15);
      }
    });
  }

  private buildAndGenerateQuote(order: Order, validityDays: number): void {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validityDays);
    this.documentsService.generateQuote({
      quoteNumber: order.orderCode,
      customerName: order.customerName || 'Sin cliente',
      date: order.createdAt,
      validUntil: validUntil.toISOString(),
      items: (order.items || []).map(item => ({ productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal })),
      subtotal: order.subtotal,
      tax: order.tax,
      discount: order.discount,
      total: order.total,
      notes: order.notes || undefined
    });
  }
}
