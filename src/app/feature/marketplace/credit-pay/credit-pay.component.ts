import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { PaymentVoucherUploadComponent } from '../order-tracking/payment-voucher-upload.component';

const METHODS: Record<string, string> = {
  TRANSFERENCIA: 'Transferencia', NEQUI: 'Nequi', DAVIPLATA: 'Daviplata', TARJETA: 'Tarjeta', EFECTIVO: 'Efectivo', OTRO: 'Otro',
};
const STATUS: Record<string, string> = {
  PENDIENTE_VERIFICACION: 'Por verificar', VERIFICADO: 'Verificado', RECHAZADO: 'Rechazado',
};

/**
 * Pago de una cuenta de cartera (enlace del recordatorio de pago, sin cuenta):
 * el cliente ve lo que debe, los datos de pago de la tienda y sube el
 * comprobante, que la tienda verifica en Cartera.
 */
@Component({
  selector: 'app-credit-pay',
  standalone: true,
  imports: [CommonModule, PaymentVoucherUploadComponent],
  template: `
    <div class="cp-page">
      <div class="cp-card" *ngIf="data as d; else state">
        <header class="cp-brand">
          <img *ngIf="d.store.logoUrl" [src]="d.store.logoUrl" [alt]="d.store.name">
          <h1>{{ d.store.name }}</h1>
          <p>Pago de tu cuenta</p>
        </header>

        <section class="cp-body">
          <p>Hola <strong>{{ d.customerName }}</strong>,</p>
          <p *ngIf="open">
            Tu factura <strong>{{ d.documentCode }}</strong>{{ ' ' }}<strong [class.late]="d.isOverdue">{{ dueText }}</strong>
            (fecha de vencimiento: {{ d.dueDate | date:'dd/MM/yyyy':'UTC' }}).
          </p>
          <p *ngIf="!open" class="cp-paid">✅ La factura <strong>{{ d.documentCode }}</strong> está {{ d.status === 'PAGADA' ? 'pagada' : 'cerrada' }}. ¡Gracias!</p>

          <table class="cp-totals" *ngIf="open">
            <tr><td>Saldo pendiente</td><td>{{ money(d.balance) }}</td></tr>
            <tr *ngIf="d.interestPending > 0" class="late"><td>Intereses de mora</td><td>{{ money(d.interestPending) }}</td></tr>
            <tr class="total"><td>Total a pagar</td><td>{{ money(d.totalDue) }}</td></tr>
            <tr *ngIf="d.pendingVerification > 0" class="muted"><td>Comprobantes por verificar</td><td>{{ money(d.pendingVerification) }}</td></tr>
          </table>

          <div class="cp-instructions" *ngIf="open && d.paymentInstructions">
            <h3>Cómo pagar</h3>
            <p class="pre">{{ d.paymentInstructions }}</p>
          </div>

          <app-payment-voucher-upload *ngIf="open && toPay > 0"
            [token]="token" [endpoint]="uploadUrl" [suggestedAmount]="toPay" (uploaded)="load()"></app-payment-voucher-upload>
          <p class="cp-note" *ngIf="open && toPay <= 0">Ya recibimos comprobantes por el total. {{ d.store.name }} los está verificando.</p>

          <div class="cp-history" *ngIf="d.vouchers.length">
            <h3>Tus comprobantes</h3>
            <ul>
              <li *ngFor="let v of d.vouchers">
                <span>{{ v.createdAt | date:'dd/MM/yyyy' }} · {{ method(v.method) }}</span>
                <b>{{ money(v.amount) }}</b>
                <em [class]="'st-' + v.status">{{ status(v.status) }}</em>
                <small *ngIf="v.rejectReason" class="late">Motivo: {{ v.rejectReason }}</small>
              </li>
            </ul>
          </div>
        </section>
        <footer class="cp-foot">Para cualquier duda comunícate directamente con {{ d.store.name }}.<br>Enviado por InOut · CycloNet S.A.S.</footer>
      </div>
      <ng-template #state>
        <div class="cp-card cp-state">{{ error || 'Cargando…' }}</div>
      </ng-template>
    </div>
  `,
  styles: [`
    .cp-page { min-height: 100vh; background: #f4f5f7; padding: 24px 12px; font-family: 'Segoe UI', Arial, sans-serif; }
    .cp-card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 18px rgba(0,0,0,.08); }
    .cp-brand { text-align: center; padding: 26px 24px 18px; border-bottom: 4px solid #1f2a44; }
    .cp-brand img { display: block; margin: 0 auto 12px; max-width: 160px; max-height: 80px; }
    .cp-brand h1 { margin: 0; font-size: 21px; font-weight: 800; color: #1f2a44; }
    .cp-brand p { margin: 6px 0 0; color: #6b7280; font-size: 13px; }
    .cp-body { padding: 24px; color: #333; line-height: 1.6; font-size: 15px; }
    .cp-totals { width: 100%; border-collapse: collapse; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; margin: 8px 0 18px; }
    .cp-totals td { padding: 12px 16px; font-size: 14px; color: #4b5563; }
    .cp-totals td:last-child { text-align: right; font-weight: 700; color: #1f2937; }
    .cp-totals tr.total td { border-top: 1px solid #e5e7eb; font-size: 15px; font-weight: 800; color: #1f2937; }
    .cp-totals tr.muted td { color: #9ca3af; font-size: 13px; }
    .late { color: #b91c1c !important; }
    .cp-instructions { background: #eef4ff; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; }
    .cp-instructions h3, .cp-history h3 { margin: 0 0 6px; font-size: 15px; }
    .pre { white-space: pre-line; margin: 0; font-size: 14px; }
    .cp-paid { background: #e8f5e9; color: #2e7d32; border-radius: 10px; padding: 12px; }
    .cp-note { color: #6b7280; font-size: 14px; }
    .cp-history ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .cp-history li { display: grid; grid-template-columns: 1fr auto auto; gap: 4px 12px; align-items: center; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .cp-history li small { grid-column: 1 / -1; }
    .cp-history em { font-style: normal; font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #fef3c7; color: #92400e; }
    .cp-history em.st-VERIFICADO { background: #e8f5e9; color: #2e7d32; }
    .cp-history em.st-RECHAZADO { background: #fde2e2; color: #b91c1c; }
    .cp-foot { background: #f4f5f7; padding: 14px 24px; text-align: center; color: #9ca3af; font-size: 12px; }
    .cp-state { padding: 40px 24px; text-align: center; color: #6b7280; }
  `],
})
export class CreditPayComponent implements OnInit {
  token = '';
  data: any = null;
  error = '';

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.load();
  }

  get uploadUrl(): string { return `${environment.apiUrl}/credit-pay/${this.token}/vouchers`; }
  get open(): boolean { return ['PENDIENTE', 'PARCIAL'].includes(this.data?.status); }
  /** Lo que falta por pagar descontando los comprobantes que ya están por verificar. */
  get toPay(): number { return Math.max(0, Math.round((this.data?.totalDue || 0) - (this.data?.pendingVerification || 0))); }
  get dueText(): string {
    const d = this.data;
    if (!d) return '';
    if (d.isOverdue) return `está vencida hace ${d.daysOverdue} día(s)`;
    return d.daysToDue === 0 ? 'vence hoy' : `vence en ${d.daysToDue} día(s)`;
  }

  load(): void {
    this.http.get<any>(`${environment.apiUrl}/credit-pay/${this.token}`).subscribe({
      next: (d) => { this.data = d; this.error = ''; },
      error: (err) => { this.data = null; this.error = err?.status === 404 ? 'Este enlace de pago no es válido o ya no existe.' : 'No pudimos cargar tu cuenta. Intenta de nuevo en unos minutos.'; },
    });
  }

  money(v: number): string { return '$ ' + Math.round(Number(v) || 0).toLocaleString('es-CO'); }
  method(m: string): string { return METHODS[m] || m; }
  status(s: string): string { return STATUS[s] || s; }
}
