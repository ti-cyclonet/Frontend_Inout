import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { formatCop } from '../../../shared/utils/currency.util';
import { GiftCardDraft, GiftCardOptions } from './gift-cards';

/**
 * "Regala un bono": el comprador elige el valor y para quién es. El bono va
 * al carrito y se paga con las formas de pago de la tienda; el código se
 * entrega en el seguimiento del pedido cuando se confirma el pago.
 */
@Component({
  selector: 'app-gift-card-buy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="product-modal-overlay gift-overlay" (click)="close.emit()">
      <div class="gift-modal" role="dialog" aria-modal="true" aria-label="Regala un bono" (click)="$event.stopPropagation()">
        <button class="modal-close" type="button" (click)="close.emit()" aria-label="Cerrar">&times;</button>
        <div class="gift-card-preview" aria-hidden="true">
          <span class="gift-card-preview__store">{{ storeName }}</span>
          <span class="gift-card-preview__label">🎁 Bono de regalo</span>
          <strong>{{ amount ? fmt(amount) : '$ —' }}</strong>
          <small>Para {{ draft.recipientName || '…' }}</small>
        </div>

        <h3 class="gift-title">Regala un bono</h3>
        <p class="gift-help">Lo pagas con las formas de pago de la tienda. Cuando se confirme el pago te damos el código para compartirlo; quien lo recibe lo usa en esta tienda con su cuenta.</p>

        <label class="gift-label">Valor</label>
        <div class="gift-amounts">
          <button type="button" *ngFor="let p of options.presets" [class.active]="!custom && amount === p" (click)="pick(p)">{{ fmt(p) }}</button>
          <button type="button" [class.active]="custom" (click)="custom = true; amount = null">Otro valor</button>
        </div>
        <input *ngIf="custom" class="gift-input" type="number" [min]="options.minAmount" [max]="options.maxAmount" step="1000"
               [(ngModel)]="amount" [placeholder]="'Entre ' + fmt(options.minAmount) + ' y ' + fmt(options.maxAmount)">

        <label class="gift-label" for="gift-to">¿Para quién es? *</label>
        <input id="gift-to" class="gift-input" type="text" maxlength="80" [(ngModel)]="draft.recipientName" placeholder="Nombre de quien recibe">
        <div class="gift-row">
          <div>
            <label class="gift-label" for="gift-email">Su correo <small>(opcional)</small></label>
            <input id="gift-email" class="gift-input" type="email" [(ngModel)]="draft.recipientEmail" placeholder="correo@ejemplo.com">
          </div>
          <div>
            <label class="gift-label" for="gift-phone">Su WhatsApp <small>(opcional)</small></label>
            <input id="gift-phone" class="gift-input" type="tel" maxlength="30" [(ngModel)]="draft.recipientPhone" placeholder="300 123 4567">
          </div>
        </div>
        <small class="gift-note" *ngIf="draft.recipientEmail">Solo podrá usarlo la cuenta de la tienda con ese correo.</small>
        <label class="gift-label" for="gift-from">De parte de <small>(opcional)</small></label>
        <input id="gift-from" class="gift-input" type="text" maxlength="80" [(ngModel)]="draft.senderName" placeholder="Tu nombre">
        <label class="gift-label" for="gift-msg">Mensaje <small>(opcional)</small></label>
        <textarea id="gift-msg" class="gift-input" rows="2" maxlength="300" [(ngModel)]="draft.message" placeholder="¡Feliz cumpleaños!"></textarea>

        <p class="gift-error" *ngIf="error">{{ error }}</p>
        <button type="button" class="gift-add" (click)="submit()">Agregar al carrito</button>
        <small class="gift-note">Vigencia: {{ options.validityMonths }} {{ options.validityMonths === 1 ? 'mes' : 'meses' }} desde que se activa. Para usarlo hay que tener cuenta en la tienda.</small>
      </div>
    </div>
  `,
  styles: [`
    .gift-overlay { position: fixed; inset: 0; z-index: 1100; background: rgba(5, 11, 26, 0.6); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 1.25rem; }
    .gift-modal { position: relative; width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto; padding: 1.4rem; border-radius: 24px; background: var(--mk-surface, #fff); color: var(--mk-text, #0b1530); box-shadow: 0 30px 80px -30px rgba(0,0,0,.6); }
    .modal-close { position: absolute; top: 12px; right: 12px; z-index: 2; width: 32px; height: 32px; border-radius: 50%; border: none; background: #f1f3f6; color: inherit; font-size: 1.2rem; line-height: 1; cursor: pointer; }
    .gift-card-preview { position: relative; display: grid; gap: 2px; padding: 1.1rem 1.2rem; margin-bottom: 1rem; border-radius: 18px; color: #fff; overflow: hidden;
      background: radial-gradient(circle at 85% 15%, rgba(255,255,255,.25), transparent 40%), linear-gradient(135deg, var(--mk-sector, #e85f00), #7c3aed); }
    .gift-card-preview__store { font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .9; }
    .gift-card-preview__label { font-size: .9rem; opacity: .95; }
    .gift-card-preview strong { font-size: 2rem; font-weight: 800; letter-spacing: -.01em; }
    .gift-card-preview small { font-size: .85rem; opacity: .9; }
    .gift-title { margin: 0; font-size: 1.25rem; font-weight: 800; }
    .gift-help { margin: .3rem 0 .8rem; font-size: .85rem; color: var(--mk-muted, #4b5878); }
    .gift-label { display: block; margin: .7rem 0 .3rem; font-size: .82rem; font-weight: 700; }
    .gift-label small { font-weight: 400; color: var(--mk-muted, #4b5878); }
    .gift-input { width: 100%; box-sizing: border-box; padding: .6rem .75rem; border: 1.5px solid var(--mk-border, #e3e8f2); border-radius: 12px; font: inherit; font-size: .9rem; }
    .gift-input:focus { outline: none; border-color: var(--mk-sector, #e85f00); }
    .gift-amounts { display: flex; flex-wrap: wrap; gap: .45rem; margin-bottom: .45rem; }
    .gift-amounts button { padding: .5rem .9rem; border-radius: 999px; border: 1.5px solid var(--mk-border, #e3e8f2); background: #fff; font-weight: 700; cursor: pointer; }
    .gift-amounts button.active { border-color: var(--mk-sector, #e85f00); background: var(--mk-sector-soft, #fff1e6); color: var(--mk-sector-ink, #b54700); }
    .gift-row { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; }
    @media (max-width: 480px) { .gift-row { grid-template-columns: 1fr; } }
    .gift-note { display: block; margin-top: .4rem; font-size: .75rem; color: var(--mk-muted, #4b5878); }
    .gift-error { margin: .7rem 0 0; padding: .5rem .7rem; border-radius: 10px; background: #fef2f2; color: #b91c1c; font-size: .85rem; }
    .gift-add { width: 100%; margin-top: 1rem; padding: .85rem; border: none; border-radius: 999px; font-weight: 700; font-size: .95rem; color: #fff; cursor: pointer;
      background: linear-gradient(135deg, var(--mk-orange, #ff7a1a), var(--mk-orange-d, #e85f00)); }
  `],
})
export class GiftCardBuyComponent implements OnInit {
  @Input() options!: GiftCardOptions;
  @Input() storeName = '';
  @Input() defaultSender = '';
  @Output() add = new EventEmitter<GiftCardDraft>();
  @Output() close = new EventEmitter<void>();

  amount: number | null = null;
  custom = false;
  draft: GiftCardDraft = { amount: 0, recipientName: '', recipientEmail: '', recipientPhone: '', senderName: '', message: '' };
  error = '';
  fmt = formatCop;

  ngOnInit(): void {
    this.draft.senderName = this.defaultSender || '';
    this.amount = this.options.presets[1] ?? this.options.presets[0] ?? null;
    this.custom = !this.options.presets.length;
  }

  pick(p: number): void {
    this.custom = false;
    this.amount = p;
  }

  submit(): void {
    const amount = Math.round(Number(this.amount));
    const o = this.options;
    const email = (this.draft.recipientEmail || '').trim();
    if (!amount || amount < o.minAmount || amount > o.maxAmount) {
      this.error = `El bono debe ser de ${this.fmt(o.minAmount)} a ${this.fmt(o.maxAmount)}.`;
      return;
    }
    if ((this.draft.recipientName || '').trim().length < 2) {
      this.error = 'Escribe el nombre de la persona que recibe el bono.';
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error = 'El correo no es válido (o déjalo vacío).';
      return;
    }
    this.error = '';
    this.add.emit({
      amount,
      recipientName: this.draft.recipientName.trim(),
      ...(email ? { recipientEmail: email.toLowerCase() } : {}),
      ...(this.draft.recipientPhone?.trim() ? { recipientPhone: this.draft.recipientPhone.trim() } : {}),
      ...(this.draft.senderName?.trim() ? { senderName: this.draft.senderName.trim() } : {}),
      ...(this.draft.message?.trim() ? { message: this.draft.message.trim() } : {}),
    });
  }
}
