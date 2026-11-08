import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ONLINE_PAYMENTS_NOT_AVAILABLE, OnlinePaymentsService, OnlinePaymentsStatus } from '../../../shared/services/online-payments.service';

/** Resultado de la vuelta de Mercado Pago (?mp=…) al conectar la cuenta. */
const RETURN_MESSAGES: Record<string, { icon: 'success' | 'info' | 'warning' | 'error'; title: string; text: string }> = {
  connected: { icon: 'success', title: 'Cuenta conectada', text: 'Tu tienda ya puede recibir pagos en línea con Mercado Pago.' },
  cancelled: { icon: 'info', title: 'No se conectó la cuenta', text: 'Cancelaste la autorización en Mercado Pago. Puedes intentarlo cuando quieras.' },
  expired: { icon: 'warning', title: 'El enlace venció', text: 'Vuelve a pulsar «Conectar mi cuenta de Mercado Pago».' },
  error: { icon: 'error', title: 'No se pudo conectar', text: 'Mercado Pago no respondió como esperábamos. Intenta de nuevo en unos minutos.' },
  unavailable: { icon: 'info', title: 'Pagos en línea en configuración', text: ONLINE_PAYMENTS_NOT_AVAILABLE },
};

/**
 * Pagos en línea con la cuenta de Mercado Pago del negocio, dentro de Formas
 * de pago. Mientras CycloNet termina la configuración se muestra "En
 * configuración" y el negocio puede pedir que le avisemos; cuando esté
 * disponible, conecta su cuenta, la apaga en la tienda o la desconecta.
 */
@Component({
  selector: 'app-online-payments-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="op" [class.op--on]="st?.account?.connected">
      <div class="op-head">
        <strong>🌐 Pagos en línea con Mercado Pago</strong>
        <span class="op-chip op-chip--config" *ngIf="st && !st.available">En configuración</span>
        <span class="op-chip op-chip--ok" *ngIf="st?.available && st?.account?.connected">Conectada</span>
        <span class="op-chip op-chip--warn" *ngIf="st?.available && st?.account?.status === 'ERROR'">Reconecta tu cuenta</span>
      </div>
      <small class="op-help">Tarjeta, PSE y efectivo. El pago se confirma solo, sin revisar comprobantes.</small>

      <p class="op-loading" *ngIf="loading">Consultando…</p>

      <!-- En configuración: aún no disponible; se avisa cuando lo esté -->
      <ng-container *ngIf="st && !st.available">
        <p class="op-msg" role="status">
          ⏳ Estamos terminando de configurar los pagos en línea. <strong>Todavía no están disponibles</strong> y no tienes que hacer nada por ahora:
          te avisaremos por correo cuando puedas conectar tu cuenta de Mercado Pago.
        </p>
        <div class="op-notify" *ngIf="!st.notify.requested">
          <input type="email" [(ngModel)]="email" placeholder="Correo para avisarte" maxlength="255" aria-label="Correo para avisarte">
          <button type="button" class="op-btn" [disabled]="busy" (click)="notifyMe()">{{ busy ? 'Guardando…' : 'Avísame cuando esté disponible' }}</button>
        </div>
        <p class="op-ok" *ngIf="st.notify.requested">
          ✅ Te avisaremos a <strong>{{ st.notify.email }}</strong> cuando esté disponible.
          <button type="button" class="op-link" (click)="st.notify.requested = false">Cambiar correo</button>
        </p>
      </ng-container>

      <!-- Disponible, sin conectar -->
      <ng-container *ngIf="st?.available && !st?.account?.connected">
        <p class="op-msg" *ngIf="st?.account?.status === 'ERROR'">⚠ {{ st?.account?.lastError || 'Mercado Pago dejó de aceptar el acceso de InOut.' }} Vuelve a conectar tu cuenta.</p>
        <button type="button" class="op-btn op-btn--mp" [disabled]="busy" (click)="connect()">{{ busy ? 'Abriendo Mercado Pago…' : 'Conectar mi cuenta de Mercado Pago' }}</button>
      </ng-container>

      <!-- Conectada -->
      <ng-container *ngIf="st?.available && st?.account?.connected">
        <p class="op-ok">Cuenta {{ st?.account?.providerUserId ? 'N° ' + st?.account?.providerUserId : '' }} conectada{{ st?.account?.connectedAt ? ' el ' + (st?.account?.connectedAt | date: 'd MMM y') : '' }}.</p>
        <label class="op-switch">
          <input type="checkbox" [ngModel]="st?.account?.enabledForStore" (ngModelChange)="setEnabled($event)" [disabled]="busy">
          <span>Ofrecer pago en línea en mi tienda <small>(el cliente paga desde el enlace de su pedido)</small></span>
        </label>
        <button type="button" class="op-link op-link--danger" [disabled]="busy" (click)="disconnect()">Desconectar cuenta</button>
      </ng-container>

      <details class="op-info">
        <summary>¿Cómo funcionará y qué implica?</summary>
        <ul>
          <li><strong>Es opcional.</strong> Solo aplica si lo activas; tus demás formas de pago siguen igual.</li>
          <li><strong>Necesitas tu propia cuenta de Mercado Pago</strong> verificada (cédula o NIT y cuenta bancaria). La conectas a InOut con un clic, sin compartir tu contraseña.</li>
          <li><strong>El dinero llega directo a tu cuenta</strong> de Mercado Pago. CycloNet no recibe ni retiene tus ventas.</li>
          <li><strong>Costos por cada pago aprobado:</strong> la tarifa de Mercado Pago (según tu plan con ellos) y una <strong>comisión de CycloNet del {{ st?.commissionPercent ?? 1 }} %</strong> del valor pagado. Ambas se descuentan automáticamente del pago.</li>
          <li><strong>Factura de la comisión:</strong> CycloNet te enviará cada mes una factura electrónica con el total de comisiones del mes, para tu contabilidad.</li>
          <li><strong>Devoluciones:</strong> si devuelves un pago, Mercado Pago lo descuenta de tu cuenta y CycloNet devuelve su parte de la comisión.</li>
          <li><strong>Puedes desconectarla cuando quieras</strong>; los pagos ya recibidos no se ven afectados.</li>
        </ul>
      </details>
    </div>
  `,
  styles: [`
    .op { border: 1px dashed #93c5fd; border-radius: 10px; background: #f8fbff; padding: 0.6rem 0.8rem; margin: 0.25rem 0 0.75rem; }
    .op--on { border-style: solid; border-color: #86efac; background: #f6fef9; }
    .op-head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .op-help { display: block; color: #6b7280; font-size: 0.78rem; margin-top: 0.1rem; }
    .op-chip { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 999px; padding: 0.1rem 0.5rem; }
    .op-chip--config { color: #92400e; background: #fef3c7; }
    .op-chip--ok { color: #166534; background: #dcfce7; }
    .op-chip--warn { color: #9a3412; background: #ffedd5; }
    .op-loading { font-size: 0.8rem; color: #6b7280; margin: 0.4rem 0 0; }
    .op-msg { font-size: 0.83rem; color: #374151; margin: 0.5rem 0; line-height: 1.45; }
    .op-ok { font-size: 0.83rem; color: #166534; margin: 0.5rem 0; }
    .op-notify { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.4rem 0; }
    .op-notify input { flex: 1 1 200px; min-width: 0; border: 1px solid #d1d5db; border-radius: 8px; padding: 0.4rem 0.6rem; font-size: 0.85rem; }
    .op-btn { border: 0; border-radius: 8px; padding: 0.45rem 0.9rem; font-size: 0.83rem; font-weight: 600; background: #1d4ed8; color: #fff; cursor: pointer; }
    .op-btn--mp { background: #009ee3; margin: 0.4rem 0; }
    .op-btn:disabled { opacity: 0.6; cursor: default; }
    .op-link { border: 0; background: none; color: #1d4ed8; font-size: 0.8rem; padding: 0; margin-left: 0.3rem; cursor: pointer; text-decoration: underline; }
    .op-link--danger { color: #b91c1c; margin: 0.3rem 0 0; }
    .op-switch { display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.85rem; margin: 0.3rem 0; cursor: pointer; }
    .op-switch input { margin-top: 0.2rem; }
    .op-switch small { color: #6b7280; }
    .op-info { margin: 0.5rem 0 0; font-size: 0.8rem; color: #374151; }
    .op-info summary { cursor: pointer; color: #1d4ed8; font-weight: 600; }
    .op-info ul { margin: 0.4rem 0 0.2rem; padding-left: 1.1rem; display: grid; gap: 0.25rem; }
  `],
})
export class OnlinePaymentsSettingsComponent implements OnInit {
  st: OnlinePaymentsStatus | null = null;
  loading = true;
  busy = false;
  email = '';

  constructor(private api: OnlinePaymentsService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.email = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('user_email')) || '';
    this.load();
    this.showReturnMessage();
  }

  private load(): void {
    this.api.status().subscribe({
      next: (s) => this.apply(s),
      // Sin respuesta: igual se informa que está en configuración
      error: () => this.apply({
        available: false, provider: 'MERCADOPAGO', message: ONLINE_PAYMENTS_NOT_AVAILABLE, commissionPercent: 1,
        account: { status: 'NOT_CONNECTED', connected: false, providerUserId: null, connectedAt: null, enabledForStore: false, lastError: null },
        notify: { requested: false, email: null, requestedAt: null },
      }),
    });
  }

  private apply(s: OnlinePaymentsStatus): void {
    this.st = s;
    this.loading = false;
    this.busy = false;
    if (s.notify.email) this.email = s.notify.email;
  }

  /** Vuelta de Mercado Pago: muestra el resultado y limpia ?mp= de la URL. */
  private showReturnMessage(): void {
    const mp = this.route.snapshot.queryParamMap.get('mp');
    const m = mp ? RETURN_MESSAGES[mp] : null;
    if (!m) return;
    Swal.fire({ ...m, confirmButtonColor: '#0057B8' });
    this.router.navigate([], { relativeTo: this.route, queryParams: { mp: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  notifyMe(): void {
    const email = this.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Swal.fire('Correo no válido', 'Escribe el correo donde quieres que te avisemos.', 'warning');
      return;
    }
    this.busy = true;
    this.api.notifyMe(email).subscribe({
      next: (s) => this.apply(s),
      error: (e) => { this.busy = false; Swal.fire('No se pudo guardar', e?.error?.message || 'Intenta de nuevo.', 'error'); },
    });
  }

  connect(): void {
    this.busy = true;
    this.api.connectUrl().subscribe({
      next: ({ url }) => (window.location.href = url),
      error: (e) => {
        this.busy = false;
        Swal.fire('Pagos en línea', e?.error?.message || ONLINE_PAYMENTS_NOT_AVAILABLE, 'info');
      },
    });
  }

  setEnabled(enabled: boolean): void {
    this.busy = true;
    this.api.setEnabledForStore(enabled).subscribe({
      next: (s) => this.apply(s),
      error: (e) => { this.busy = false; Swal.fire('No se pudo guardar', e?.error?.message || 'Intenta de nuevo.', 'error'); },
    });
  }

  disconnect(): void {
    Swal.fire({
      title: '¿Desconectar tu cuenta de Mercado Pago?',
      text: 'Tus clientes ya no podrán pagar en línea. Los pagos ya recibidos no se afectan.',
      icon: 'question', showCancelButton: true, confirmButtonText: 'Desconectar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc3545',
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.busy = true;
      this.api.disconnect().subscribe({ next: (s) => this.apply(s), error: () => (this.busy = false) });
    });
  }
}
