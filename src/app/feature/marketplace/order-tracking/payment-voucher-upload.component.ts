import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { formatCop } from '../../../shared/utils/currency.util';
import { amountMatches, readPaymentProof } from '../../../shared/utils/payment-proof-ocr';

/** Medios con los que el comprador suele pagar por fuera (el efectivo lo registra el negocio). */
const CUSTOMER_METHODS = [
  { value: 'TRANSFERENCIA', label: 'Transferencia bancaria' },
  { value: 'NEQUI', label: 'Nequi' },
  { value: 'DAVIPLATA', label: 'Daviplata' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'OTRO', label: 'Otro' },
];

/**
 * Formulario para que el comprador suba el comprobante de un pago de su
 * pedido (anticipo, abono o saldo). Usa el token del enlace de seguimiento,
 * así que funciona también para invitados sin cuenta. El pago queda "por
 * verificar" hasta que el negocio lo confirme.
 */
@Component({
  selector: 'app-payment-voucher-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="voucher-box" *ngIf="!sent; else sentTpl">
      <h4 class="voucher-title">📎 Sube tu comprobante de pago</h4>
      <div class="voucher-row">
        <label>Valor pagado</label>
        <input type="text" inputmode="numeric" [value]="amountText" (input)="onAmountInput($event)" placeholder="$0" />
      </div>
      <div class="voucher-row">
        <label>Medio</label>
        <select [(ngModel)]="method">
          <option *ngFor="let m of methods" [value]="m.value">{{ m.label }}</option>
        </select>
      </div>
      <div class="voucher-row">
        <label>Foto del comprobante</label>
        <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onFile($event)" />
      </div>
      <div class="voucher-row">
        <label>Referencia</label>
        <input type="text" maxlength="100" [(ngModel)]="reference" [placeholder]="reading ? 'Leyendo el comprobante…' : 'Número de la transacción'" />
      </div>
      <p class="voucher-note" *ngIf="note">{{ note }}</p>
      <p class="voucher-error" *ngIf="error">{{ error }}</p>
      <button type="button" class="voucher-btn" [disabled]="sending" (click)="send()">
        {{ sending ? 'Enviando…' : 'Enviar comprobante' }}
      </button>
    </div>
    <ng-template #sentTpl>
      <p class="voucher-sent">✅ Recibimos tu comprobante. La tienda lo verificará y verás el pago confirmado en el seguimiento de tu pedido.</p>
    </ng-template>
  `,
  styles: [`
    .voucher-box { border: 1px dashed #cbd5e1; border-radius: 10px; padding: 12px; margin: 12px 0; text-align: left; }
    .voucher-title { font-size: 0.95rem; margin: 0 0 8px; }
    .voucher-row { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; font-size: 0.85rem; }
    .voucher-row input, .voucher-row select { padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.9rem; }
    .voucher-error { color: #c62828; font-size: 0.82rem; margin: 4px 0; }
    .voucher-note { color: #475569; font-size: 0.8rem; margin: 2px 0 4px; }
    .voucher-btn { width: 100%; border: none; border-radius: 10px; padding: 10px; background: #e65c00; color: #fff; font-weight: 600; cursor: pointer; }
    .voucher-btn:disabled { opacity: .6; cursor: default; }
    .voucher-sent { background: #e8f5e9; color: #2e7d32; border-radius: 10px; padding: 10px; font-size: 0.88rem; }
  `],
})
export class PaymentVoucherUploadComponent implements OnChanges {
  @Input() token!: string;
  /** Dónde se envía (por defecto, el pago de un pedido; cartera usa el suyo). */
  @Input() endpoint?: string;
  /** Monto sugerido (anticipo o saldo). */
  @Input() suggestedAmount = 0;
  @Output() uploaded = new EventEmitter<void>();

  methods = CUSTOMER_METHODS;
  amount: number | null = null;
  method = 'TRANSFERENCIA';
  reference = '';
  file: File | null = null;
  sending = false;
  sent = false;
  error = '';

  constructor(private http: HttpClient) {}

  ngOnChanges(): void {
    if (!this.amount && this.suggestedAmount > 0) this.amount = Math.round(this.suggestedAmount);
  }

  /** "Valor pagado" con formato de pesos ("$18.245"); por dentro es un número. */
  get amountText(): string {
    return this.amount ? formatCop(this.amount) : '';
  }

  onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    this.amount = digits ? Number(digits) : null;
    // Reescribe el campo ya formateado y deja el cursor al final
    input.value = this.amountText;
    input.setSelectionRange(input.value.length, input.value.length);
  }

  /** Lectura de la foto (OCR) para poner la referencia sola. */
  reading = false;
  note = '';
  /** Valores en pesos que leyó el OCR en la foto. */
  amounts: number[] = [];

  onFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] || null;
    this.note = '';
    this.amounts = [];
    if (this.file) this.readFile(this.file);
  }

  private async readFile(file: File): Promise<void> {
    this.reading = true;
    try {
      const { reference, amounts } = await readPaymentProof(file);
      if (this.file !== file) return;
      if (reference && !this.reference.trim()) {
        this.reference = reference;
        this.note = 'Leímos la referencia del comprobante: revisa que esté bien.';
      } else if (!reference) {
        this.note = 'No pudimos leer la referencia: escríbela tal como aparece en el comprobante.';
      }
      this.amounts = amounts;
      if (this.amount && !amountMatches(amounts, Number(this.amount))) {
        this.note += ` El comprobante dice ${formatCop(Math.max(...amounts))}: el valor pagado debe ser el del comprobante.`;
      }
    } catch {
      if (this.file === file) this.note = 'Escribe la referencia tal como aparece en el comprobante.';
    } finally {
      if (this.file === file) this.reading = false;
    }
  }

  send(): void {
    this.error = '';
    if (!this.amount || this.amount <= 0) { this.error = 'Indica el valor que pagaste.'; return; }
    if (!this.file) { this.error = 'Adjunta la foto del comprobante.'; return; }
    if (this.file.size > 5 * 1024 * 1024) { this.error = 'La imagen supera 5 MB.'; return; }
    if (this.reading) { this.error = 'Espera un momento: estamos leyendo el comprobante.'; return; }
    // Cada comprobante se reporta por su valor (si pagaste en partes, sube un comprobante por cada pago)
    if (!amountMatches(this.amounts, Number(this.amount))) {
      this.error = `El comprobante dice ${formatCop(Math.max(...this.amounts))} y estás reportando ${formatCop(Number(this.amount))}. `
        + 'Escribe el valor del comprobante; si pagaste en varias partes, sube cada comprobante por separado. Si el valor sí es el correcto, sube una foto más clara.';
      return;
    }
    // La referencia evita que un mismo comprobante se use en dos pagos
    if (this.reference.replace(/[^A-Za-z0-9]/g, '').length < 4) { this.error = 'Escribe el número de referencia del comprobante.'; return; }

    const form = new FormData();
    form.append('amount', String(this.amount));
    form.append('method', this.method);
    form.append('reference', this.reference.trim());
    form.append('file', this.file);

    this.sending = true;
    this.http.post(this.endpoint || `${environment.apiUrl}/orders/marketplace/track/${this.token}/payments`, form).subscribe({
      next: () => { this.sending = false; this.sent = true; this.uploaded.emit(); },
      error: (err) => {
        this.sending = false;
        const msg = err?.error?.message;
        this.error = Array.isArray(msg) ? msg[0] : msg || 'No se pudo enviar el comprobante. Intenta de nuevo.';
      },
    });
  }
}
