import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DineInChoice, DiningPublicInfo, DiningPublicService, depositOf } from './dining-public.service';
import { DineInPickerComponent } from './dine-in-picker.component';
import { LEGAL_VERSIONS, LegalDocKey } from '../legal/marketplace-legal';

/**
 * Reservar mesa (solo la mesa) desde la tienda. Si la tienda reserva con el
 * pedido, invita a llenar el carrito y elegir Comer en el local.
 */
@Component({
  selector: 'app-table-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, DineInPickerComponent],
  template: `
    <div class="tb-overlay" (click)="closed.emit()">
      <div class="tb-modal" role="dialog" aria-modal="true" aria-labelledby="tb-title" (click)="$event.stopPropagation()">
        <div class="tb-head">
          <h3 id="tb-title">🍽️ Reservar mesa</h3>
          <button type="button" class="tb-x" (click)="closed.emit()" aria-label="Cerrar">×</button>
        </div>

        <ng-container *ngIf="info?.preorderMode === 'required'; else form">
          <p class="tb-text">En {{ storeName || 'esta tienda' }} la reserva va con tu pedido, para tenerlo listo cuando llegues.</p>
          <ol class="tb-steps">
            <li>Agrega tus productos al carrito.</li>
            <li>En el pago elige <b>Comer en el local</b>.</li>
            <li>Escoge el día, la hora y cuántas personas son.</li>
          </ol>
          <button type="button" class="tb-btn" (click)="closed.emit()">Ver el menú</button>
        </ng-container>

        <ng-template #form>
          <app-dine-in-picker [tenantId]="tenantId" [info]="info" (choiceChange)="choice = $event"></app-dine-in-picker>
          <p class="tb-note" *ngIf="info?.preorderMode === 'optional'">¿Quieres tu pedido listo al llegar? Agrégalo al carrito y en el pago elige <b>Comer en el local</b>.</p>

          <div class="tb-fields">
            <label>Nombre <input type="text" maxlength="120" [(ngModel)]="name" autocomplete="name"></label>
            <label>Celular <input type="tel" maxlength="30" [(ngModel)]="phone" autocomplete="tel"></label>
            <label>Correo <small>(opcional)</small> <input type="email" maxlength="120" [(ngModel)]="email" autocomplete="email"></label>
            <label>Notas <small>(opcional)</small> <input type="text" maxlength="500" [(ngModel)]="notes" placeholder="Cumpleaños, silla de bebé…"></label>
          </div>

          <div class="tb-deposit" *ngIf="deposit > 0">
            💳 Para confirmar la reserva se paga un anticipo de <b>{{ money(deposit) }}</b>. Después de reservar te mostramos cómo pagarlo y subes el comprobante.
          </div>
          <p class="tb-note" *ngIf="deposit === 0 && info?.confirmMode === 'manual'">La tienda confirma tu reserva; sigue su estado en el enlace que te damos.</p>

          <label class="tb-check"><input type="checkbox" [(ngModel)]="terms">
            <span>Acepto los <a href="javascript:void(0)" (click)="$event.preventDefault(); legal.emit('terms')">Términos y Condiciones</a>.</span></label>
          <label class="tb-check"><input type="checkbox" [(ngModel)]="habeas">
            <span>Autorizo el <a href="javascript:void(0)" (click)="$event.preventDefault(); legal.emit('habeasData')">tratamiento de mis datos personales</a> (Ley 1581 de 2012).</span></label>

          <p class="tb-error" *ngIf="error">{{ error }}</p>
          <button type="button" class="tb-btn" (click)="book()" [disabled]="sending || !choice || !name.trim() || !phone.trim() || !terms || !habeas">
            {{ sending ? 'Reservando…' : 'Reservar' }}
          </button>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .tb-overlay { position: fixed; inset: 0; z-index: 1080; background: rgba(15, 23, 42, 0.5); display: flex; align-items: flex-start; justify-content: center; padding: 4vh 0.75rem; overflow-y: auto; }
    .tb-modal { background: #fff; width: 100%; max-width: 520px; border-radius: 18px; padding: 1.1rem 1.1rem 1.25rem; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; gap: 0.8rem; }
    .tb-head { display: flex; justify-content: space-between; align-items: center; }
    .tb-head h3 { margin: 0; font-size: 1.2rem; font-weight: 800; }
    .tb-x { border: 0; background: #f1f5f9; width: 34px; height: 34px; border-radius: 50%; font-size: 1.3rem; line-height: 1; }
    .tb-text { margin: 0; }
    .tb-steps { margin: 0; padding-left: 1.2rem; }
    .tb-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; }
    .tb-fields label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.82rem; font-weight: 600; }
    .tb-fields small { font-weight: 400; color: #6b7280; }
    .tb-fields input { border: 1px solid #d1d5db; border-radius: 10px; padding: 0.5rem 0.65rem; font-size: 0.95rem; }
    .tb-note { margin: 0; font-size: 0.85rem; color: #4b5563; }
    .tb-deposit { background: #fff7ed; color: #9a3412; border-radius: 10px; padding: 0.6rem 0.75rem; font-size: 0.88rem; }
    .tb-check { display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.85rem; margin: 0; }
    .tb-check input { margin-top: 0.2rem; }
    .tb-error { margin: 0; color: #b91c1c; font-size: 0.88rem; }
    .tb-btn { border: 0; border-radius: 12px; padding: 0.75rem; font-weight: 800; font-size: 1rem; background: var(--mk-sector, #0066cc); color: #fff; }
    .tb-btn:disabled { opacity: 0.55; }
    @media (max-width: 480px) { .tb-fields { grid-template-columns: 1fr; } }
  `],
})
export class TableBookingComponent {
  @Input() tenantId = '';
  @Input() info: DiningPublicInfo | null = null;
  @Input() storeName = '';
  @Output() closed = new EventEmitter<void>();
  @Output() legal = new EventEmitter<LegalDocKey>();

  choice: DineInChoice | null = null;
  name = '';
  phone = '';
  email = '';
  notes = '';
  terms = false;
  habeas = false;
  sending = false;
  error = '';

  constructor(private dining: DiningPublicService, private router: Router) {}

  get deposit(): number {
    return depositOf(this.info, this.choice?.partySize || 2);
  }

  money(n: number): string {
    return '$' + Math.round(n).toLocaleString('es-CO');
  }

  book(): void {
    if (!this.choice) return;
    this.sending = true;
    this.error = '';
    this.dining.book(this.tenantId, {
      ...this.choice,
      customerName: this.name.trim(),
      customerPhone: this.phone.trim(),
      customerEmail: this.email.trim() || null,
      notes: this.notes.trim() || null,
      acceptTerms: this.terms,
      acceptHabeasData: this.habeas,
      termsVersion: LEGAL_VERSIONS.terms,
      habeasDataVersion: LEGAL_VERSIONS.habeasData,
    }).subscribe({
      next: (r) => {
        this.sending = false;
        this.closed.emit();
        this.router.navigate(['/marketplace', this.tenantId, 'reserva', r.token]);
      },
      error: (err) => {
        this.sending = false;
        this.error = err?.error?.message || 'No se pudo reservar. Intenta de nuevo.';
      },
    });
  }
}
