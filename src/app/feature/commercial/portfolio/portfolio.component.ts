import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { CreditService, PAYMENT_METHODS, paymentMethodLabel } from '../../../shared/services/credit.service';
import { CustomersService } from '../../../shared/services/customers.service';
import { decodeJwtPayload } from '../../../shared/utils/jwt.util';

type View = 'summary' | 'receivables' | 'credits';

const REQUEST_LABELS: Record<string, string> = {
  SOLICITADA: 'Solicitada',
  VALIDADA: 'Validada',
  CUPO_ASIGNADO: 'Cupo asignado',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

const HISTORY_LABELS: Record<string, string> = {
  SOLICITUD: 'Solicitud',
  VALIDACION: 'Validación',
  ASIGNACION: 'Asignación de cupo',
  APROBACION: 'Aprobación',
  RECHAZO: 'Rechazo',
  SUSPENSION: 'Suspensión',
  REACTIVACION: 'Reactivación',
};

/** Escapa texto de usuario antes de insertarlo en el HTML de SweetAlert. */
const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
)[c]);

/**
 * Cartera: resumen (saldos, vencida, antigüedad), cuentas por cobrar con
 * abonos, y créditos de clientes con el flujo solicitud → validación →
 * asignación de cupo → aprobación. Aprobar/rechazar, suspender y anular son
 * solo para administradores (el backend lo exige igual).
 */
@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.css'],
})
export class PortfolioComponent implements OnInit {
  view: View = 'summary';
  isAdmin = false;
  canOperate = false;

  summary: any = null;
  loadingSummary = false;

  receivables: any[] = [];
  loadingReceivables = false;
  receivableStatus: 'OPEN' | 'OVERDUE' | 'PAGADA' | 'ANULADA' | '' = 'OPEN';
  receivableSearch = '';

  accounts: any[] = [];
  loadingAccounts = false;
  accountFilter: 'all' | 'inProgress' | 'approved' | 'rejected' | 'suspended' = 'all';
  accountSearch = '';

  readonly requestLabels = REQUEST_LABELS;
  readonly paymentMethods = PAYMENT_METHODS;

  constructor(private creditService: CreditService, private customersService: CustomersService) {}

  ngOnInit(): void {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
    const role = (token ? decodeJwtPayload(token)?.rol : '') || '';
    this.isAdmin = ['adminInout', 'admin'].includes(role);
    this.canOperate = this.isAdmin || ['operatorInout', 'operator'].includes(role);
    this.loadSummary();
  }

  setView(v: View): void {
    this.view = v;
    if (v === 'summary') this.loadSummary();
    if (v === 'receivables') this.loadReceivables();
    if (v === 'credits') this.loadAccounts();
  }

  refresh(): void {
    this.setView(this.view);
  }

  // ═══════════════ Resumen ═══════════════
  loadSummary(): void {
    this.loadingSummary = true;
    this.creditService.summary().subscribe({
      next: (s) => { this.summary = s; this.loadingSummary = false; },
      error: () => { this.loadingSummary = false; },
    });
  }

  agingPercent(value: number): number {
    const total = this.summary?.total || 0;
    return total > 0 ? Math.max(2, Math.round((value / total) * 100)) : 0;
  }

  openCustomerReceivables(customerName: string): void {
    this.receivableSearch = customerName;
    this.receivableStatus = 'OPEN';
    this.setView('receivables');
  }

  // ═══════════════ Cuentas por cobrar ═══════════════
  loadReceivables(): void {
    this.loadingReceivables = true;
    const status = this.receivableStatus === 'OVERDUE' ? 'OPEN' : this.receivableStatus;
    this.creditService.listReceivables({ status: status || undefined, overdue: this.receivableStatus === 'OVERDUE' }).subscribe({
      next: (rows) => { this.receivables = rows; this.loadingReceivables = false; },
      error: () => { this.receivables = []; this.loadingReceivables = false; },
    });
  }

  get filteredReceivables(): any[] {
    const q = this.receivableSearch.trim().toLowerCase();
    if (!q) return this.receivables;
    return this.receivables.filter((r) => `${r.customerName} ${r.documentCode}`.toLowerCase().includes(q));
  }

  get receivablesTotals() {
    const rows = this.filteredReceivables;
    return {
      amount: rows.reduce((s, r) => s + r.amount, 0),
      paid: rows.reduce((s, r) => s + r.paidAmount, 0),
      balance: rows.reduce((s, r) => s + r.balance, 0),
    };
  }

  statusLabel(r: any): string {
    if (r.status === 'PENDIENTE' || r.status === 'PARCIAL') {
      if (r.isOverdue) return `Vencida · ${r.daysOverdue} d`;
      return r.status === 'PARCIAL' ? 'Abonada' : 'Pendiente';
    }
    return r.status === 'PAGADA' ? 'Pagada' : 'Anulada';
  }

  statusClass(r: any): string {
    if (r.status === 'PAGADA') return 'st-paid';
    if (r.status === 'ANULADA') return 'st-void';
    if (r.isOverdue) return 'st-overdue';
    return r.daysToDue !== null && r.daysToDue <= 7 ? 'st-soon' : 'st-open';
  }

  dueHint(r: any): string {
    if (r.status !== 'PENDIENTE' && r.status !== 'PARCIAL') return '';
    if (r.isOverdue) return `Vencida hace ${r.daysOverdue} día(s)`;
    if (r.daysToDue === 0) return 'Vence hoy';
    return `Vence en ${r.daysToDue} día(s)`;
  }

  async registerPayment(r: any): Promise<void> {
    const methods = PAYMENT_METHODS.map((m) => `<option value="${m.value}">${m.label}</option>`).join('');
    const today = new Date().toISOString().slice(0, 10);
    const res = await Swal.fire({
      title: 'Registrar abono',
      width: 520,
      html: `
        <div class="pf-form">
          <p class="pf-form-head"><strong>${esc(r.documentCode)}</strong> · ${esc(r.customerName)}<br>
            <span>Saldo pendiente: <strong>${this.formatCurrency(r.balance)}</strong></span></p>
          <label>Valor del abono *<input id="pf-amount" type="number" min="0.01" step="0.01" class="swal2-input" value="${r.balance}"></label>
          <label>Medio de pago *<select id="pf-method" class="swal2-select">${methods}</select></label>
          <label>Referencia<input id="pf-ref" class="swal2-input" maxlength="100" placeholder="N° de transacción, recibo…"></label>
          <label>Fecha<input id="pf-date" type="date" class="swal2-input" value="${today}" max="${today}"></label>
          <label>Observaciones<textarea id="pf-notes" class="swal2-textarea" maxlength="1000"></textarea></label>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Registrar abono',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0066CC',
      preConfirm: () => {
        const amount = Number((document.getElementById('pf-amount') as HTMLInputElement).value);
        if (!(amount > 0)) { Swal.showValidationMessage('Ingresa un valor mayor a cero.'); return false; }
        if (amount > r.balance + 0.005) { Swal.showValidationMessage('El abono no puede superar el saldo.'); return false; }
        return {
          amount,
          method: (document.getElementById('pf-method') as HTMLSelectElement).value,
          reference: (document.getElementById('pf-ref') as HTMLInputElement).value.trim() || undefined,
          paymentDate: (document.getElementById('pf-date') as HTMLInputElement).value || undefined,
          notes: (document.getElementById('pf-notes') as HTMLTextAreaElement).value.trim() || undefined,
        };
      },
    });
    if (!res.isConfirmed || !res.value) return;
    this.creditService.registerPayment(r.id, res.value).subscribe({
      next: (updated: any) => {
        Swal.fire({ icon: 'success', title: updated.status === 'PAGADA' ? '¡Cuenta saldada!' : 'Abono registrado', timer: 1500, showConfirmButton: false });
        this.loadReceivables();
      },
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo registrar el abono', 'error'),
    });
  }

  viewReceivable(r: any): void {
    this.creditService.getReceivable(r.id).subscribe({
      next: (detail) => {
        const payments = (detail.payments || []).map((p: any) => `
          <tr><td>${esc(p.paymentDate)}</td><td>${esc(paymentMethodLabel(p.method))}</td><td>${esc(p.reference || '—')}</td>
          <td class="num">${this.formatCurrency(p.amount)}</td></tr>`).join('');
        Swal.fire({
          title: esc(detail.documentCode),
          width: 640,
          html: `
            <div class="pf-detail">
              <div class="pf-detail-grid">
                <div><span>Cliente</span><strong>${esc(detail.customerName)}</strong></div>
                <div><span>Origen</span><strong>${detail.sourceType === 'SALE' ? 'Venta directa' : 'Pedido'}</strong></div>
                <div><span>Emisión</span><strong>${esc(detail.issueDate)}</strong></div>
                <div><span>Vence</span><strong>${esc(detail.dueDate)} (${detail.termDays} días)</strong></div>
                <div><span>Valor</span><strong>${this.formatCurrency(detail.amount)}</strong></div>
                <div><span>Saldo</span><strong>${this.formatCurrency(detail.balance)}</strong></div>
              </div>
              ${detail.voidReason ? `<p class="pf-void">Anulada: ${esc(detail.voidReason)}</p>` : ''}
              <h4>Abonos</h4>
              ${payments
                ? `<table class="pf-table"><thead><tr><th>Fecha</th><th>Medio</th><th>Referencia</th><th class="num">Valor</th></tr></thead><tbody>${payments}</tbody></table>`
                : '<p class="pf-empty">Sin abonos todavía.</p>'}
            </div>`,
          confirmButtonText: 'Cerrar',
          confirmButtonColor: '#0066CC',
        });
      },
      error: () => Swal.fire('Error', 'No se pudo cargar el detalle', 'error'),
    });
  }

  async voidReceivable(r: any): Promise<void> {
    const res = await Swal.fire({
      title: `¿Anular ${esc(r.documentCode)}?`,
      text: 'Solo para corregir un registro equivocado. La cuenta sale de la cartera del cliente.',
      icon: 'warning',
      input: 'textarea',
      inputLabel: 'Motivo de la anulación',
      showCancelButton: true,
      confirmButtonText: 'Anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
      inputValidator: (v) => (!v || v.trim().length < 5 ? 'Escribe el motivo (mínimo 5 caracteres)' : null),
    });
    if (!res.isConfirmed) return;
    this.creditService.voidReceivable(r.id, String(res.value).trim()).subscribe({
      next: () => { Swal.fire({ icon: 'success', title: 'Cuenta anulada', timer: 1400, showConfirmButton: false }); this.loadReceivables(); },
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo anular', 'error'),
    });
  }

  // ═══════════════ Créditos ═══════════════
  loadAccounts(): void {
    this.loadingAccounts = true;
    this.creditService.listAccounts().subscribe({
      next: (rows) => { this.accounts = rows; this.loadingAccounts = false; },
      error: () => { this.accounts = []; this.loadingAccounts = false; },
    });
  }

  isInProgress(a: any): boolean {
    return ['SOLICITADA', 'VALIDADA', 'CUPO_ASIGNADO'].includes(a.requestStatus);
  }

  get filteredAccounts(): any[] {
    const q = this.accountSearch.trim().toLowerCase();
    return this.accounts.filter((a) => {
      if (this.accountFilter === 'inProgress' && !this.isInProgress(a)) return false;
      if (this.accountFilter === 'approved' && !a.isActive) return false;
      if (this.accountFilter === 'rejected' && a.requestStatus !== 'RECHAZADA') return false;
      if (this.accountFilter === 'suspended' && !a.suspended) return false;
      if (q && !`${a.customerName} ${a.customerEmail || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  get accountCounts() {
    return {
      all: this.accounts.length,
      inProgress: this.accounts.filter((a) => this.isInProgress(a)).length,
      approved: this.accounts.filter((a) => a.isActive).length,
      rejected: this.accounts.filter((a) => a.requestStatus === 'RECHAZADA').length,
      suspended: this.accounts.filter((a) => a.suspended).length,
    };
  }

  /** Paso del flujo (1-4) para la barra de progreso del trámite. */
  step(a: any): number {
    return ({ SOLICITADA: 1, VALIDADA: 2, CUPO_ASIGNADO: 3, APROBADA: 4, RECHAZADA: 4 } as any)[a.requestStatus] || 1;
  }

  async newRequest(prefill?: any): Promise<void> {
    let customers: any[] = [];
    try {
      customers = await new Promise<any[]>((resolve, reject) =>
        this.customersService.getCustomers().subscribe({ next: (c: any) => resolve(c || []), error: reject }));
    } catch {
      Swal.fire('Error', 'No se pudieron cargar los clientes', 'error');
      return;
    }
    const busy = new Set(this.accounts.filter((a) => this.isInProgress(a)).map((a) => a.customerId));
    const nameOf = (c: any) => (c.businessName || [c.firstName, c.secondName, c.firstSurname, c.secondSurname].filter(Boolean).join(' ') || c.email || 'Cliente').trim();
    const options = customers
      .filter((c) => c.id && (!busy.has(c.id) || c.id === prefill?.customerId))
      .map((c) => `<option value="${esc(c.id)}" ${prefill?.customerId === c.id ? 'selected' : ''}>${esc(nameOf(c))}${c.documentNumber ? ' · ' + esc(c.documentNumber) : ''}</option>`)
      .join('');
    if (!options) {
      Swal.fire('Sin clientes', 'No hay clientes registrados disponibles para solicitar crédito. Asigna el rol Cliente desde el módulo Usuarios.', 'info');
      return;
    }
    const res = await Swal.fire({
      title: prefill ? 'Solicitar ajuste de crédito' : 'Nueva solicitud de crédito',
      width: 540,
      html: `
        <div class="pf-form">
          <label>Cliente *<select id="cr-customer" class="swal2-select" ${prefill ? 'disabled' : ''}>${options}</select></label>
          <label>Cupo solicitado *<input id="cr-amount" type="number" min="1" step="1000" class="swal2-input" value="${prefill?.approvedLimit || ''}" placeholder="Ej.: 1000000"></label>
          <label>Plazo de pago solicitado (días) *
            <select id="cr-term" class="swal2-select">
              ${[8, 15, 30, 45, 60, 90].map((d) => `<option value="${d}" ${(prefill?.approvedTermDays || 30) === d ? 'selected' : ''}>${d} días</option>`).join('')}
            </select></label>
          <label>Observaciones<textarea id="cr-notes" class="swal2-textarea" maxlength="1000" placeholder="Motivo, referencias aportadas…"></textarea></label>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Registrar solicitud',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0066CC',
      preConfirm: () => {
        const customerId = (document.getElementById('cr-customer') as HTMLSelectElement).value;
        const amount = Number((document.getElementById('cr-amount') as HTMLInputElement).value);
        if (!customerId) { Swal.showValidationMessage('Selecciona el cliente.'); return false; }
        if (!(amount > 0)) { Swal.showValidationMessage('Ingresa el cupo solicitado.'); return false; }
        const c = customers.find((x) => x.id === customerId);
        return {
          customerId,
          customerName: c ? nameOf(c) : prefill?.customerName,
          customerEmail: c?.email || undefined,
          requestedAmount: amount,
          requestedTermDays: Number((document.getElementById('cr-term') as HTMLSelectElement).value),
          notes: (document.getElementById('cr-notes') as HTMLTextAreaElement).value.trim() || undefined,
        };
      },
    });
    if (!res.isConfirmed || !res.value) return;
    this.creditService.createRequest(res.value).subscribe({
      next: () => { Swal.fire({ icon: 'success', title: 'Solicitud registrada', text: 'Siguiente paso: validación.', timer: 1600, showConfirmButton: false }); this.loadAccounts(); },
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo registrar la solicitud', 'error'),
    });
  }

  async validateRequest(a: any): Promise<void> {
    const res = await Swal.fire({
      title: 'Validar solicitud',
      width: 560,
      html: `
        <div class="pf-form">
          <p class="pf-form-head"><strong>${esc(a.customerName)}</strong><br>
            <span>Solicita ${this.formatCurrency(a.requestedAmount)} a ${a.requestedTermDays} días</span>
            ${a.requestNotes ? `<br><em>${esc(a.requestNotes)}</em>` : ''}</p>
          <p class="pf-subtitle">Lista de chequeo</p>
          <label class="pf-check"><input type="checkbox" id="cv-id"> Identidad y datos del cliente verificados</label>
          <label class="pf-check"><input type="checkbox" id="cv-ref"> Referencias comerciales / personales verificadas</label>
          <label class="pf-check"><input type="checkbox" id="cv-cap"> Capacidad de pago verificada</label>
          <p class="pf-note">El historial interno del cliente (compras y cartera con el negocio) se guarda automáticamente con la validación.</p>
          <label>Observaciones<textarea id="cv-obs" class="swal2-textarea" maxlength="1000"></textarea></label>
          <p class="pf-subtitle">Resultado</p>
          <label class="pf-check"><input type="radio" name="cv-result" value="ok" checked> Cumple: pasa a asignación de cupo</label>
          <label class="pf-check"><input type="radio" name="cv-result" value="no"> No cumple: rechazar solicitud</label>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Guardar validación',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0066CC',
      preConfirm: () => {
        const checked = (id: string) => (document.getElementById(id) as HTMLInputElement).checked;
        const meets = (document.querySelector('input[name="cv-result"]:checked') as HTMLInputElement)?.value === 'ok';
        const observations = (document.getElementById('cv-obs') as HTMLTextAreaElement).value.trim();
        if (meets && !(checked('cv-id') && checked('cv-ref') && checked('cv-cap'))) {
          Swal.showValidationMessage('Para aprobar la validación marca los tres puntos de la lista.');
          return false;
        }
        if (!meets && observations.length < 5) {
          Swal.showValidationMessage('Indica en observaciones por qué no cumple.');
          return false;
        }
        return {
          identityVerified: checked('cv-id'),
          referencesVerified: checked('cv-ref'),
          paymentCapacityVerified: checked('cv-cap'),
          meetsRequirements: meets,
          observations: observations || undefined,
        };
      },
    });
    if (!res.isConfirmed || !res.value) return;
    this.creditService.validate(a.id, res.value).subscribe({
      next: () => { Swal.fire({ icon: 'success', title: 'Validación registrada', timer: 1400, showConfirmButton: false }); this.loadAccounts(); },
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo validar', 'error'),
    });
  }

  async assignLimit(a: any): Promise<void> {
    const h = a.validation?.internalHistory;
    const res = await Swal.fire({
      title: 'Asignar cupo y condición de pago',
      width: 540,
      html: `
        <div class="pf-form">
          <p class="pf-form-head"><strong>${esc(a.customerName)}</strong><br>
            <span>Solicitó ${this.formatCurrency(a.requestedAmount)} a ${a.requestedTermDays} días</span></p>
          ${h ? `<div class="pf-history"><span>${h.purchasesCount} compra(s) por ${this.formatCurrency(h.purchasesTotal)}</span>
            <span>Cartera: ${this.formatCurrency(h.outstanding)}${h.overdueCount ? ` · ${h.overdueCount} vencida(s)` : ''}</span></div>` : ''}
          <label>Cupo a asignar *<input id="ca-limit" type="number" min="1" step="1000" class="swal2-input" value="${a.requestedAmount}"></label>
          <label>Condición de pago (días de plazo) *<input id="ca-term" type="number" min="1" max="365" class="swal2-input" value="${a.requestedTermDays}"></label>
          <p class="pf-note">Luego un administrador debe aprobarlo para que el cliente pueda comprar a crédito.</p>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Asignar cupo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0066CC',
      preConfirm: () => {
        const limit = Number((document.getElementById('ca-limit') as HTMLInputElement).value);
        const termDays = Math.round(Number((document.getElementById('ca-term') as HTMLInputElement).value));
        if (!(limit > 0)) { Swal.showValidationMessage('Ingresa el cupo.'); return false; }
        if (!(termDays >= 1 && termDays <= 365)) { Swal.showValidationMessage('El plazo debe estar entre 1 y 365 días.'); return false; }
        return { limit, termDays };
      },
    });
    if (!res.isConfirmed || !res.value) return;
    this.creditService.assign(a.id, res.value).subscribe({
      next: () => { Swal.fire({ icon: 'success', title: 'Cupo asignado', text: 'Pendiente de aprobación.', timer: 1500, showConfirmButton: false }); this.loadAccounts(); },
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo asignar el cupo', 'error'),
    });
  }

  async decide(a: any): Promise<void> {
    const res = await Swal.fire({
      title: 'Aprobar crédito',
      width: 520,
      html: `
        <div class="pf-form">
          <p class="pf-form-head"><strong>${esc(a.customerName)}</strong></p>
          <div class="pf-detail-grid">
            <div><span>Cupo propuesto</span><strong>${this.formatCurrency(a.proposedLimit)}</strong></div>
            <div><span>Condición de pago</span><strong>${a.proposedTermDays} días</strong></div>
            <div><span>Cupo vigente</span><strong>${this.formatCurrency(a.approvedLimit)}</strong></div>
            <div><span>Saldo actual</span><strong>${this.formatCurrency(a.outstanding)}</strong></div>
          </div>
          <label>Motivo (obligatorio si rechazas)<textarea id="cd-reason" class="swal2-textarea" maxlength="1000"></textarea></label>
        </div>`,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Aprobar',
      denyButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#16a34a',
      denyButtonColor: '#dc3545',
      preDeny: () => {
        const reason = (document.getElementById('cd-reason') as HTMLTextAreaElement).value.trim();
        if (reason.length < 5) { Swal.showValidationMessage('Indica el motivo del rechazo.'); return false; }
        return reason;
      },
    });
    if (res.isDismissed) return;
    const approve = res.isConfirmed;
    const reason = res.isDenied ? String(res.value) : undefined;
    this.creditService.decide(a.id, { approve, reason }).subscribe({
      next: () => { Swal.fire({ icon: 'success', title: approve ? 'Crédito aprobado' : 'Solicitud rechazada', timer: 1500, showConfirmButton: false }); this.loadAccounts(); },
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo registrar la decisión', 'error'),
    });
  }

  async toggleSuspend(a: any): Promise<void> {
    if (a.suspended) {
      const ok = await Swal.fire({ title: `¿Reactivar el crédito de ${esc(a.customerName)}?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Reactivar', cancelButtonText: 'Cancelar', confirmButtonColor: '#16a34a' });
      if (!ok.isConfirmed) return;
      this.creditService.setSuspended(a.id, { suspended: false }).subscribe({ next: () => this.loadAccounts(), error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo reactivar', 'error') });
      return;
    }
    const res = await Swal.fire({
      title: `¿Suspender el crédito de ${esc(a.customerName)}?`,
      text: 'No podrá comprar a crédito hasta que se reactive. Su cartera actual no cambia.',
      icon: 'warning', input: 'textarea', inputLabel: 'Motivo de la suspensión',
      showCancelButton: true, confirmButtonText: 'Suspender', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc3545',
      inputValidator: (v) => (!v || v.trim().length < 5 ? 'Escribe el motivo (mínimo 5 caracteres)' : null),
    });
    if (!res.isConfirmed) return;
    this.creditService.setSuspended(a.id, { suspended: true, reason: String(res.value).trim() }).subscribe({
      next: () => this.loadAccounts(),
      error: (err) => Swal.fire('Error', err?.error?.message || 'No se pudo suspender', 'error'),
    });
  }

  showHistory(a: any): void {
    const v = a.validation;
    const rows = [...(a.history || [])].reverse().map((h: any) => `
      <li><strong>${esc(HISTORY_LABELS[h.action] || h.action)}</strong>
        <span>${new Date(h.at).toLocaleString('es-CO')} · ${esc(h.byEmail || 'sistema')}</span>
        ${h.detail ? `<em>${esc(h.detail)}</em>` : ''}</li>`).join('');
    Swal.fire({
      title: esc(a.customerName),
      width: 620,
      html: `
        <div class="pf-detail">
          <div class="pf-detail-grid">
            <div><span>Trámite</span><strong>${esc(REQUEST_LABELS[a.requestStatus] || a.requestStatus)}</strong></div>
            <div><span>Cupo aprobado</span><strong>${this.formatCurrency(a.approvedLimit)}</strong></div>
            <div><span>Condición de pago</span><strong>${a.approvedTermDays ? a.approvedTermDays + ' días' : '—'}</strong></div>
            <div><span>Disponible</span><strong>${this.formatCurrency(a.available)}</strong></div>
          </div>
          ${a.rejectionReason && a.requestStatus === 'RECHAZADA' ? `<p class="pf-void">Rechazo: ${esc(a.rejectionReason)}</p>` : ''}
          ${v ? `<h4>Validación</h4><ul class="pf-checks">
            <li>${v.identityVerified ? '✓' : '✗'} Identidad</li><li>${v.referencesVerified ? '✓' : '✗'} Referencias</li><li>${v.paymentCapacityVerified ? '✓' : '✗'} Capacidad de pago</li></ul>
            <p class="pf-note">Historial interno al validar: ${v.internalHistory.purchasesCount} compra(s) por ${this.formatCurrency(v.internalHistory.purchasesTotal)} · cartera ${this.formatCurrency(v.internalHistory.outstanding)}</p>
            ${v.observations ? `<p class="pf-note">${esc(v.observations)}</p>` : ''}` : ''}
          <h4>Historial</h4>
          <ul class="pf-timeline">${rows || '<li>Sin movimientos</li>'}</ul>
        </div>`,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#0066CC',
    });
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(v) || 0);
  }
}
