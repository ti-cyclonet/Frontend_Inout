import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';
import { OrderFormComponent } from './form/order-form.component';
import { InvoiceService } from '../../shared/services/invoice.service';

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
    private invoiceService: InvoiceService
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

    this.http.patch<any>(`${this.baseUrl}/${order.id}/status`, { status: next }).subscribe({
      next: () => {
        Swal.fire({ icon: 'success', title: 'Estado actualizado', text: `Pedido avanzó a: ${this.getStatusLabel(next)}`, timer: 1500, showConfirmButton: false });
        this.loadOrders();
        this.loadStats();
      },
      error: (err) => {
        Swal.fire({ icon: 'error', title: 'Error', text: err.error?.message || 'No se pudo actualizar el estado' });
      }
    });
  }

  cancelOrder(order: Order): void {
    Swal.fire({
      title: '¿Cancelar pedido?',
      text: `Se cancelará el pedido ${order.orderCode}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.patch<any>(`${this.baseUrl}/${order.id}/status`, { status: 'CANCELLED' }).subscribe({
          next: () => { this.loadOrders(); this.loadStats(); },
          error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo cancelar', 'error'); }
        });
      }
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

  kanbanStatuses = ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'DELIVERED'];

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
    this.invoiceService.generateOrderInvoice(order).then(() => {
      Swal.fire({ icon: 'success', title: 'PDF Generado', text: `Factura del pedido ${order.orderCode} descargada`, timer: 1500, showConfirmButton: false });
    }).catch((err) => {
      console.error('Error generating PDF:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo generar el PDF' });
    });
  }
}
