import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../shared/services/notification.service';

interface Lot {
  id: string;
  date: string;
  quantity: number;
  document: string;
  supplier: string;
  /** YYYY-MM-DD guardado y el que se está editando. */
  saved: string;
  value: string;
  saving: boolean;
}

/** Cuántas compras recientes se muestran: el vencimiento importa en los lotes vigentes. */
const MAX_LOTS = 8;

/**
 * Lotes (compras) del material con su fecha de vencimiento editable. El
 * vencimiento vive en cada compra, no en el material: sale de «Registro de
 * Compras» y aquí se puede corregir o quitar.
 */
@Component({
  selector: 'app-material-lots',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ml-box">
      <div class="ml-head">
        <b>Lotes y vencimientos</b>
        <small>Cada compra es un lote con su propia fecha. Corrígela si cambió o déjala vacía si no vence.</small>
      </div>
      <p class="ml-muted" *ngIf="loading">Cargando lotes…</p>
      <p class="ml-muted" *ngIf="!loading && !lots.length">Este material aún no tiene compras registradas. La fecha de vencimiento se indica al registrar la compra.</p>
      <div class="ml-row" *ngFor="let l of lots">
        <div class="ml-info">
          <span>{{ l.date | date:'dd/MM/yyyy' }} · {{ l.quantity | number:'1.0-2' }} {{ unit }}</span>
          <small>{{ l.supplier || 'Sin proveedor' }}<ng-container *ngIf="l.document"> · {{ l.document }}</ng-container></small>
        </div>
        <input type="date" class="form-control ml-date" [(ngModel)]="l.value" [ngModelOptions]="{ standalone: true }"
               [attr.aria-label]="'Vencimiento del lote del ' + (l.date | date:'dd/MM/yyyy')">
        <button type="button" class="btn btn-sm btn-primary ml-save" *ngIf="l.value !== l.saved" [disabled]="l.saving" (click)="save(l)">
          {{ l.saving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
      <small class="ml-muted" *ngIf="more > 0">Se muestran las {{ lots.length }} compras más recientes ({{ more }} anteriores en «Registro de Compras»).</small>
    </div>
  `,
  styles: [`
    .ml-box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; background: #fafafa; }
    .ml-head { display: grid; gap: 2px; margin-bottom: 8px; }
    .ml-head small, .ml-muted { color: #6b7280; font-size: .8rem; }
    .ml-muted { margin: 4px 0 0; display: block; }
    .ml-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid #eee; flex-wrap: wrap; }
    .ml-info { flex: 1 1 180px; display: grid; font-size: .85rem; }
    .ml-info small { color: #6b7280; }
    .ml-date { width: 160px; flex: 0 0 auto; }
    .ml-save { flex: 0 0 auto; }
  `],
})
export class MaterialLotsComponent implements OnChanges {
  @Input() materialId?: string | number;
  @Input() unit = '';
  lots: Lot[] = [];
  more = 0;
  loading = false;

  constructor(private http: HttpClient, private notification: NotificationService) {}

  ngOnChanges(): void {
    this.load();
  }

  load(): void {
    this.lots = [];
    this.more = 0;
    if (!this.materialId) return;
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/purchases/material/${this.materialId}`).subscribe({
      next: (rows) => {
        const all = Array.isArray(rows) ? rows : [];
        this.more = Math.max(0, all.length - MAX_LOTS);
        this.lots = all.slice(0, MAX_LOTS).map((p) => {
          const exp = p.dtmExpirationDate ? String(p.dtmExpirationDate).slice(0, 10) : '';
          return {
            id: p.strId, date: p.dtmDate, quantity: Number(p.fltQuantity) || 0,
            document: p.strDocument || '', supplier: p.supplier?.strName || '',
            saved: exp, value: exp, saving: false,
          };
        });
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  save(l: Lot): void {
    l.saving = true;
    this.http.patch(`${environment.apiUrl}/purchases/${l.id}/expiration`, { expirationDate: l.value || null }).subscribe({
      next: () => {
        l.saved = l.value;
        l.saving = false;
        this.notification.success('Vencimiento actualizado', l.value ? undefined : 'El lote quedó sin fecha de vencimiento.');
      },
      error: (err) => {
        l.saving = false;
        this.notification.error('No se pudo actualizar', err?.error?.message || 'Intenta de nuevo.');
      },
    });
  }
}
