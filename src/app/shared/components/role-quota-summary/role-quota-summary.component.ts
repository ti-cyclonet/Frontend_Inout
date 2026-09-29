import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomersService } from '../../services/customers.service';
import { decodeJwtPayload } from '../../utils/jwt.util';

/** Roles de staff de InOut (el de cliente del MarketPlace se gestiona aparte). */
const STAFF_ROLE_LABELS: Record<string, string> = {
  adminInout: 'Administradores',
  operatorInout: 'Operadores',
  viewerInout: 'Visores',
};

interface RoleQuota {
  name: string;
  label: string;
  assigned: number;
  total: number;
}

/**
 * Cupos de usuarios por rol según el plan contratado, con los datos reales de
 * Authoriza (configuración del paquete vs. roles asignados). Un rol por encima
 * de su cupo (p. ej. un plan que se redujo) se marca: los existentes se
 * conservan, pero no se pueden asignar más hasta quedar dentro del cupo.
 */
@Component({
  selector: 'app-role-quota-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rq" *ngIf="quotas.length">
      <div class="rq-item" *ngFor="let q of quotas" [class.full]="q.assigned >= q.total" [class.over]="q.assigned > q.total">
        <span class="rq-label">{{ q.label }}</span>
        <strong>{{ q.assigned }} / {{ q.total }}</strong>
      </div>
    </div>
    <p class="rq-warn" *ngIf="overQuota.length">
      ⚠ {{ overQuotaText }}: se conservan los usuarios actuales, pero no se pueden asignar más de ese rol hasta quedar dentro del cupo
      (cambia el rol de algunos usuarios o mejora tu plan).
    </p>
    <p class="rq-hint" *ngIf="showHint && quotas.length && !overQuota.length">
      Cupos de tu plan por rol. Los clientes del MarketPlace no cuentan en estos cupos.
    </p>
  `,
  styles: [`
    .rq { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; }
    .rq-item { display: flex; align-items: center; gap: 8px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; padding: 6px 10px; font-size: 13px; }
    .rq-item strong { color: #0f172a; }
    .rq-item.full { background: #fff8e1; border-color: #fcd34d; }
    .rq-item.over { background: #fdecea; border-color: #fca5a5; }
    .rq-item.over strong { color: #b91c1c; }
    .rq-label { color: #475569; }
    .rq-warn { font-size: 12px; color: #b91c1c; margin: 4px 0 0; }
    .rq-hint { font-size: 12px; color: #64748b; margin: 4px 0 0; }
  `],
})
export class RoleQuotaSummaryComponent implements OnInit, OnChanges {
  /** Cambiarlo recarga los cupos (p. ej. tras asignar o quitar un rol). */
  @Input() refreshTrigger: any;
  @Input() showHint = true;

  quotas: RoleQuota[] = [];
  private contractId: string | null = null;

  constructor(private customersService: CustomersService) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(): void {
    if (this.contractId) this.loadAvailability();
  }

  get overQuota(): RoleQuota[] {
    return this.quotas.filter((q) => q.assigned > q.total);
  }

  get overQuotaText(): string {
    return this.overQuota.map((q) => `${q.label} ${q.assigned} de ${q.total}`).join(', ');
  }

  private load(): void {
    if (typeof window === 'undefined') return;
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
    const tenantId = token ? decodeJwtPayload(token)?.tenantId : null;
    if (!tenantId) return;
    this.customersService.getTenantContract(tenantId).subscribe({
      next: (data: any) => {
        this.contractId = data?.contractId || null;
        this.loadAvailability();
      },
      error: () => {},
    });
  }

  private loadAvailability(): void {
    if (!this.contractId) return;
    this.customersService.getRoleAvailability(this.contractId).subscribe({
      next: (rows: any[]) => {
        this.quotas = (rows || [])
          .filter((r) => STAFF_ROLE_LABELS[r.role?.strName])
          .map((r) => ({
            name: r.role.strName,
            label: STAFF_ROLE_LABELS[r.role.strName],
            assigned: Number(r.assigned) || 0,
            total: Number(r.total) || 0,
          }))
          .sort((a, b) => Object.keys(STAFF_ROLE_LABELS).indexOf(a.name) - Object.keys(STAFF_ROLE_LABELS).indexOf(b.name));
      },
      error: () => { this.quotas = []; },
    });
  }
}
