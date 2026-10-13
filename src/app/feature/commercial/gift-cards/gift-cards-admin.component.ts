import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { formatCop } from '../../../shared/utils/currency.util';
import { GIFT_CARD_STATUS_LABELS, GiftCardStatus, formatExpiry } from '../../marketplace/gift-cards/gift-cards';

interface AdminGiftCard {
  id: string;
  code: string;
  amount: number;
  balance: number;
  status: GiftCardStatus;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  senderName: string | null;
  purchaserName: string | null;
  purchaseOrderId: string;
  claimed: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

const MOVEMENT_LABELS: Record<string, string> = {
  EMISION: 'Comprado', ACTIVACION: 'Activado', RECLAMO: 'Reclamado por el cliente', USO: 'Usado', DEVOLUCION: 'Devuelto al bono', ANULACION: 'Anulado',
};

/**
 * Bonos de regalo vendidos en el MarketPlace: saldo vigente (lo que aún se
 * debe en productos), estado de cada bono, su historial y anulación.
 */
@Component({
  selector: 'app-gift-cards-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="gc">
      <div class="gc-kpis">
        <div class="gc-kpi"><small>Bonos activos</small><b>{{ activeCount }}</b></div>
        <div class="gc-kpi"><small>Saldo por redimir</small><b>{{ fmt(activeBalance) }}</b><em>Lo que tus clientes aún pueden comprar con bonos</em></div>
        <div class="gc-kpi"><small>Por activar</small><b>{{ pendingCount }}</b><em>Esperando que se complete el pago</em></div>
        <div class="gc-kpi"><small>Vendido en bonos</small><b>{{ fmt(soldTotal) }}</b></div>
      </div>

      <div class="gc-toolbar">
        <input type="search" [(ngModel)]="search" placeholder="Buscar por código, para quién o quién compró">
        <select [(ngModel)]="statusFilter">
          <option value="">Todos los estados</option>
          <option *ngFor="let s of statuses" [value]="s">{{ labels[s] }}</option>
        </select>
      </div>

      <p class="gc-empty" *ngIf="!loading && !filtered.length">
        {{ cards.length ? 'Ningún bono coincide con la búsqueda.' : 'Aún no se han vendido bonos. Actívalos en MarketPlace › Bonos de regalo.' }}
      </p>
      <div class="gc-table-wrap" *ngIf="filtered.length">
        <table class="gc-table">
          <thead><tr><th>Código</th><th>Para</th><th>Compró</th><th>Valor</th><th>Saldo</th><th>Estado</th><th>Vence</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let c of filtered">
              <td class="gc-code">{{ c.code }}</td>
              <td>{{ c.recipientName }}<small *ngIf="c.recipientEmail">{{ c.recipientEmail }}</small><small *ngIf="c.claimed" class="gc-claimed">✓ En su cuenta</small></td>
              <td>{{ c.purchaserName || '—' }}</td>
              <td>{{ fmt(c.amount) }}</td>
              <td><b>{{ fmt(c.balance) }}</b></td>
              <td><span class="gc-badge" [ngClass]="c.status">{{ labels[c.status] }}</span></td>
              <td>{{ c.expiresAt ? expiry(c.expiresAt) : '—' }}</td>
              <td class="gc-actions">
                <button type="button" (click)="showHistory(c)" title="Historial">Historial</button>
                <button type="button" class="danger" *ngIf="c.status === 'ACTIVO' || c.status === 'PENDIENTE'" (click)="cancel(c)" title="Anular (solo administrador)">Anular</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .gc { padding: 1rem; }
    .gc-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .75rem; margin-bottom: 1rem; }
    .gc-kpi { display: grid; gap: 2px; padding: .9rem 1rem; border-radius: 14px; background: #fff; box-shadow: 0 0 0 1px #e5e7eb; }
    .gc-kpi small { color: #6b7280; font-size: .78rem; }
    .gc-kpi b { font-size: 1.35rem; color: #111827; }
    .gc-kpi em { font-style: normal; font-size: .72rem; color: #9ca3af; }
    .gc-toolbar { display: flex; gap: .5rem; flex-wrap: wrap; margin-bottom: .75rem; }
    .gc-toolbar input { flex: 1; min-width: 220px; padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 10px; }
    .gc-toolbar select { padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 10px; }
    .gc-empty { color: #6b7280; padding: 1rem; text-align: center; }
    .gc-table-wrap { overflow-x: auto; background: #fff; border-radius: 14px; box-shadow: 0 0 0 1px #e5e7eb; }
    .gc-table { width: 100%; border-collapse: collapse; font-size: .86rem; }
    .gc-table th { text-align: left; padding: .6rem .75rem; font-size: .75rem; color: #6b7280; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
    .gc-table td { padding: .6rem .75rem; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    .gc-table td small { display: block; font-size: .74rem; color: #6b7280; }
    .gc-claimed { color: #15803d !important; }
    .gc-code { font-family: ui-monospace, Consolas, monospace; font-weight: 700; white-space: nowrap; }
    .gc-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: .72rem; font-weight: 700; background: #f3f4f6; color: #374151; }
    .gc-badge.ACTIVO { background: #dcfce7; color: #166534; }
    .gc-badge.PENDIENTE { background: #fef9c3; color: #854d0e; }
    .gc-badge.AGOTADO { background: #e0e7ff; color: #3730a3; }
    .gc-badge.VENCIDO, .gc-badge.ANULADO { background: #fee2e2; color: #991b1b; }
    .gc-actions { white-space: nowrap; }
    .gc-actions button { padding: .3rem .6rem; margin-left: .25rem; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; font-size: .78rem; cursor: pointer; }
    .gc-actions button.danger { border-color: #fecaca; color: #b91c1c; }
  `],
})
export class GiftCardsAdminComponent implements OnInit {
  cards: AdminGiftCard[] = [];
  loading = false;
  search = '';
  statusFilter = '';
  statuses: GiftCardStatus[] = ['ACTIVO', 'PENDIENTE', 'AGOTADO', 'VENCIDO', 'ANULADO'];
  labels = GIFT_CARD_STATUS_LABELS;
  fmt = formatCop;
  expiry = formatExpiry;
  private base = `${environment.apiUrl}/gift-cards`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.http.get<AdminGiftCard[]>(this.base).subscribe({
      next: (rows) => { this.cards = rows || []; this.loading = false; },
      error: () => { this.cards = []; this.loading = false; },
    });
  }

  get filtered(): AdminGiftCard[] {
    const q = this.search.trim().toLowerCase();
    return this.cards.filter((c) =>
      (!this.statusFilter || c.status === this.statusFilter)
      && (!q || [c.code, c.recipientName, c.recipientEmail, c.purchaserName, c.senderName].some((v) => (v || '').toLowerCase().includes(q))));
  }

  get activeCount(): number { return this.cards.filter((c) => c.status === 'ACTIVO').length; }
  get pendingCount(): number { return this.cards.filter((c) => c.status === 'PENDIENTE').length; }
  get activeBalance(): number { return this.cards.filter((c) => c.status === 'ACTIVO').reduce((s, c) => s + c.balance, 0); }
  get soldTotal(): number { return this.cards.filter((c) => c.status !== 'ANULADO' && c.status !== 'PENDIENTE').reduce((s, c) => s + c.amount, 0); }

  showHistory(card: AdminGiftCard): void {
    this.http.get<any[]>(`${this.base}/${card.id}/movements`).subscribe({
      next: (rows) => {
        const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
        const items = (rows || []).map((m) => `
          <tr>
            <td style="padding:4px 8px;white-space:nowrap">${new Date(m.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td style="padding:4px 8px">${MOVEMENT_LABELS[m.type] || m.type}${m.note ? `<br><small style="color:#6b7280">${esc(m.note)}</small>` : ''}</td>
            <td style="padding:4px 8px;text-align:right;white-space:nowrap">${Number(m.amount) ? formatCop(Number(m.amount)) : ''}</td>
            <td style="padding:4px 8px;text-align:right;white-space:nowrap"><b>${formatCop(Number(m.balanceAfter))}</b></td>
          </tr>`).join('');
        Swal.fire({
          title: card.code,
          width: 640,
          html: `<table style="width:100%;font-size:.85rem;border-collapse:collapse;text-align:left">
            <thead><tr><th style="padding:4px 8px">Fecha</th><th style="padding:4px 8px">Movimiento</th><th style="padding:4px 8px;text-align:right">Valor</th><th style="padding:4px 8px;text-align:right">Saldo</th></tr></thead>
            <tbody>${items}</tbody></table>`,
          confirmButtonText: 'Cerrar',
        });
      },
      error: () => Swal.fire('Historial', 'No se pudo cargar el historial del bono.', 'error'),
    });
  }

  async cancel(card: AdminGiftCard): Promise<void> {
    const r = await Swal.fire({
      icon: 'warning',
      title: `Anular ${card.code}`,
      text: `El saldo (${formatCop(card.balance)}) dejará de poder usarse. Esta acción no se puede deshacer.`,
      input: 'text',
      inputPlaceholder: 'Motivo (ej. el cliente reportó que lo perdió)',
      showCancelButton: true,
      confirmButtonText: 'Anular bono',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      inputValidator: (v) => (!v || v.trim().length < 5 ? 'Escribe el motivo (mínimo 5 caracteres).' : null),
    });
    if (!r.isConfirmed) return;
    this.http.patch(`${this.base}/${card.id}/cancel`, { reason: r.value }).subscribe({
      next: () => { Swal.fire({ icon: 'success', title: 'Bono anulado', timer: 1400, showConfirmButton: false }); this.load(); },
      error: (err) => Swal.fire('No se pudo anular', err?.error?.message || 'Intenta de nuevo.', 'error'),
    });
  }
}
