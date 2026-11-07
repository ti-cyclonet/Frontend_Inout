import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { DiningPublicService, PublicReservation } from './dining-public.service';

const REFRESH_MS = 60_000;

/** Página de la reserva del cliente (enlace privado): estado, anticipo y cancelar. */
@Component({
  selector: 'app-reservation-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="rp">
      <div class="rp-card" *ngIf="r; else loadingTpl">
        <div class="rp-top">
          <span class="rp-emoji" aria-hidden="true">🍽️</span>
          <div>
            <p class="rp-kicker">Reserva {{ r.code }}</p>
            <h1>{{ day }}</h1>
            <p class="rp-time">{{ time(r.startAt) }} · {{ r.partySize }} {{ r.partySize === 1 ? 'persona' : 'personas' }}</p>
          </div>
        </div>

        <span class="rp-status" [ngClass]="'st-' + r.status">{{ statusText }}</span>

        <dl class="rp-data">
          <div *ngIf="r.tables.length"><dt>Mesa</dt><dd>{{ tablesText }}</dd></div>
          <div><dt>A nombre de</dt><dd>{{ r.customerName }}</dd></div>
          <div *ngIf="r.notes"><dt>Notas</dt><dd>{{ r.notes }}</dd></div>
        </dl>

        <!-- Pedido anticipado -->
        <a class="rp-order" *ngIf="r.order" [routerLink]="['/marketplace', r.tenantId, 'pedido', r.order.token]">
          🧾 Tu pedido {{ r.order.code }} estará listo a la hora de tu reserva. <b>Ver el pedido y su pago →</b>
        </a>

        <!-- Anticipo -->
        <div class="rp-deposit" *ngIf="r.deposit as d">
          <h2>Anticipo: {{ money(d.amount) }}</h2>
          <p *ngIf="d.status === 'PAGADO'" class="rp-ok">✅ Anticipo verificado.</p>
          <p *ngIf="d.status === 'POR_VERIFICAR'" class="rp-wait">⏳ Recibimos tu comprobante; la tienda lo está verificando.</p>
          <p *ngIf="d.status === 'RECHAZADO'" class="rp-bad">La tienda no pudo verificar tu comprobante. Revisa el pago y súbelo de nuevo.</p>
          <ng-container *ngIf="(d.status === 'PENDIENTE' || d.status === 'RECHAZADO') && isActive">
            <p>Paga el anticipo y sube la foto del comprobante para confirmar tu reserva.</p>
            <pre class="rp-instructions" *ngIf="d.instructions">{{ d.instructions }}</pre>
            <label class="rp-file">
              <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onFile($event)" hidden>
              📷 {{ file ? file.name : 'Elegir foto del comprobante' }}
            </label>
            <input type="text" class="rp-input" maxlength="100" [(ngModel)]="reference" placeholder="N° de referencia (opcional)">
            <button type="button" class="rp-btn" (click)="upload()" [disabled]="!file || uploading">{{ uploading ? 'Enviando…' : 'Enviar comprobante' }}</button>
          </ng-container>
          <a *ngIf="d.proofUrl" [href]="d.proofUrl" target="_blank" rel="noopener" class="rp-link">Ver el comprobante que enviaste</a>
        </div>

        <p class="rp-hint" *ngIf="isActive">Te esperamos {{ tolerance }}. Si no puedes llegar, cancela para liberar la mesa.</p>

        <div class="rp-actions">
          <button type="button" class="rp-btn rp-btn--line" *ngIf="r.canCancel && !r.order" (click)="cancel()">Cancelar reserva</button>
          <a class="rp-btn rp-btn--line" [routerLink]="['/marketplace', r.tenantId]">Volver a la tienda</a>
        </div>
      </div>
      <ng-template #loadingTpl>
        <div class="rp-card"><p>{{ error || 'Cargando tu reserva…' }}</p></div>
      </ng-template>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #f4f6fb; }
    .rp { max-width: 560px; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
    .rp-card { background: #fff; border-radius: 20px; padding: 1.25rem; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); display: flex; flex-direction: column; gap: 0.9rem; }
    .rp-top { display: flex; gap: 0.9rem; align-items: center; }
    .rp-emoji { font-size: 2.4rem; }
    .rp-kicker { margin: 0; color: #6b7280; font-size: 0.85rem; font-weight: 600; }
    .rp-top h1 { margin: 0; font-size: 1.35rem; font-weight: 800; }
    .rp-time { margin: 0; font-size: 1.05rem; font-weight: 600; }
    .rp-status { align-self: flex-start; padding: 0.3rem 0.8rem; border-radius: 999px; font-weight: 700; font-size: 0.88rem; background: #eef2f7; color: #334155; }
    .st-CONFIRMED { background: #dcfce7; color: #15803d; }
    .st-PENDING { background: #fef3c7; color: #92400e; }
    .st-SEATED, .st-COMPLETED { background: #dbeafe; color: #1d4ed8; }
    .st-CANCELLED, .st-NO_SHOW { background: #fee2e2; color: #b91c1c; }
    .rp-data { margin: 0; display: grid; gap: 0.4rem; }
    .rp-data div { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.35rem; }
    .rp-data dt { color: #6b7280; font-weight: 500; }
    .rp-data dd { margin: 0; font-weight: 600; text-align: right; }
    .rp-order { display: block; background: #eff6ff; color: #1e3a8a; border-radius: 12px; padding: 0.7rem 0.85rem; text-decoration: none; font-size: 0.92rem; }
    .rp-deposit { background: #fff7ed; border-radius: 14px; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.55rem; }
    .rp-deposit h2 { margin: 0; font-size: 1.05rem; font-weight: 800; color: #9a3412; }
    .rp-deposit p { margin: 0; font-size: 0.9rem; }
    .rp-instructions { margin: 0; white-space: pre-wrap; font-family: inherit; font-size: 0.9rem; background: #fff; border-radius: 10px; padding: 0.6rem; }
    .rp-ok { color: #15803d; } .rp-wait { color: #92400e; } .rp-bad { color: #b91c1c; }
    .rp-file { border: 1px dashed #fb923c; background: #fff; border-radius: 10px; padding: 0.6rem; text-align: center; cursor: pointer; font-weight: 600; }
    .rp-input { border: 1px solid #d1d5db; border-radius: 10px; padding: 0.55rem 0.65rem; }
    .rp-link { font-size: 0.85rem; }
    .rp-hint { margin: 0; color: #6b7280; font-size: 0.85rem; }
    .rp-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .rp-btn { border: 0; border-radius: 12px; padding: 0.65rem 1rem; font-weight: 700; background: #0066cc; color: #fff; text-decoration: none; text-align: center; }
    .rp-btn:disabled { opacity: 0.55; }
    .rp-btn--line { background: #fff; color: #334155; border: 1px solid #d1d5db; }
  `],
})
export class ReservationPageComponent implements OnInit, OnDestroy {
  r: PublicReservation | null = null;
  error = '';
  file: File | null = null;
  reference = '';
  uploading = false;
  private token = '';
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private route: ActivatedRoute, private dining: DiningPublicService) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.load();
    this.timer = setInterval(() => this.load(), REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  load(): void {
    this.dining.view(this.token).subscribe({
      next: (r) => { this.r = r; this.error = ''; },
      error: () => { if (!this.r) this.error = 'No encontramos esta reserva. Revisa el enlace.'; },
    });
  }

  get isActive(): boolean {
    return !!this.r && ['PENDING', 'CONFIRMED'].includes(this.r.status);
  }

  get statusText(): string {
    const r = this.r!;
    if (r.status === 'PENDING') {
      if (r.deposit?.status === 'POR_VERIFICAR') return 'Por confirmar: verificando tu anticipo';
      if (r.deposit && r.deposit.status !== 'PAGADO') return 'Por confirmar: falta el anticipo';
      return 'Por confirmar: la tienda la revisa';
    }
    return r.statusLabel;
  }

  get day(): string {
    const t = new Date(this.r!.startAt).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  get tablesText(): string {
    return this.r!.tables.map((t) => `${t.name} (${t.zone})`).join(' + ');
  }

  get tolerance(): string {
    return 'a la hora de tu reserva';
  }

  time(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  }

  money(n: number): string {
    return '$' + Math.round(n).toLocaleString('es-CO');
  }

  onFile(e: Event): void {
    this.file = (e.target as HTMLInputElement).files?.[0] || null;
  }

  upload(): void {
    if (!this.file) return;
    this.uploading = true;
    this.dining.uploadDeposit(this.token, this.file, this.reference.trim()).subscribe({
      next: (r) => { this.uploading = false; this.r = r; this.file = null; },
      error: (err) => { this.uploading = false; Swal.fire('No se pudo enviar', err?.error?.message || 'Intenta de nuevo.', 'error'); },
    });
  }

  cancel(): void {
    Swal.fire({ title: '¿Cancelar tu reserva?', text: 'La mesa queda libre para otras personas.', icon: 'question', showCancelButton: true, confirmButtonText: 'Sí, cancelar', cancelButtonText: 'No', confirmButtonColor: '#dc3545' })
      .then((x) => {
        if (!x.isConfirmed) return;
        this.dining.cancel(this.token).subscribe({
          next: (r) => { this.r = r; },
          error: (err) => Swal.fire('No se pudo cancelar', err?.error?.message || 'Intenta de nuevo.', 'error'),
        });
      });
  }
}
