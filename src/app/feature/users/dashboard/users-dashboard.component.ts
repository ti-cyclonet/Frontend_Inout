import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { CustomersService } from '../../../shared/services/customers.service';
import { decodeJwtPayload } from '../../../shared/utils/jwt.util';
import { LivePanel } from '../../../shared/components/panel-kit/live-panel';
import { PANEL_KIT, PkAttention } from '../../../shared/components/panel-kit/panel-kit.components';
import { RoleQuotaSummaryComponent } from '../../../shared/components/role-quota-summary/role-quota-summary.component';

const ROLES: { key: string; label: string; color: string }[] = [
  { key: 'adminInout', label: 'Administradores', color: '#0057b8' },
  { key: 'operatorInout', label: 'Operadores', color: '#11998e' },
  { key: 'viewerInout', label: 'Visores', color: '#667eea' },
  { key: 'clienteInout', label: 'Clientes (MarketPlace)', color: '#f5a623' },
];

interface UsersSummary {
  total: number; staff: number; active: number; inactive: number; clients: number; newThisMonth: number; signers: number; noRole: number;
  byRole: { key: string; label: string; color: string; count: number }[];
  newest: { id: string; name: string; role: string; at: string }[];
}

/**
 * Panel de Usuarios: equipo y clientes del negocio (dependientes en
 * Authoriza), cupos por rol del plan y novedades, en vivo.
 */
@Component({
  selector: 'app-users-dashboard',
  standalone: true,
  imports: [CommonModule, RoleQuotaSummaryComponent, ...PANEL_KIT],
  template: `
    <div class="dashboard-wrapper" style="height: 100%;">
      <div class="page-subtitle-row" style="border-top: 1px solid orange">
        <div class="page-subtitle">
          <svg viewBox="0 0 16 16"><use xlink:href="./assets/icons/bootstrap-icons.svg#speedometer2" /></svg>
          /Panel Principal
        </div>
        <div class="header-actions">
          <a class="action-link action-link-primary" (click)="openCreateModal.emit()" style="cursor:pointer;">
            <svg viewBox="0 0 16 16" width="16" height="16"><use xlink:href="./assets/icons/bootstrap-icons.svg#person-plus" /></svg>
            Usuario
          </a>
        </div>
      </div>

      <div class="dashboard-container pk" style="border-bottom: 1px solid orange;">
        <div class="pk-head" style="margin-top: 0">
          <div><h2>Tu equipo</h2><p>Usuarios del negocio y clientes del MarketPlace</p></div>
          <app-pk-live *ngIf="!loading" [updatedAt]="lastUpdated" [stale]="stale" [refreshing]="refreshing" (refresh)="refresh()"></app-pk-live>
        </div>

        <div class="pk-grid" *ngIf="loading"><div class="pk-skeleton" *ngFor="let i of [1, 2, 3, 4]"></div></div>
        <div class="pk-error" *ngIf="error && !loading">{{ error }}</div>

        <ng-container *ngIf="data as d">
          <div class="pk-grid">
            <app-pk-kpi icon="people-fill" tone="blue" label="Equipo" [value]="d.staff"><span>administradores, operadores y visores</span></app-pk-kpi>
            <app-pk-kpi icon="person-check-fill" tone="green" label="Activos" [value]="d.active">
              <span class="pk-chip" [class.warn]="d.inactive" [class.ok]="!d.inactive">{{ d.inactive ? d.inactive + ' inactivo(s)' : 'Todos activos' }}</span>
            </app-pk-kpi>
            <app-pk-kpi icon="bag-heart-fill" tone="orange" label="Clientes del MarketPlace" [value]="d.clients"><span>con cuenta en tu tienda</span></app-pk-kpi>
            <app-pk-kpi icon="person-plus-fill" tone="violet" label="Nuevos este mes" [value]="d.newThisMonth"><span>{{ d.signers }} firmante(s) autorizado(s)</span></app-pk-kpi>
          </div>

          <div class="pk-row half">
            <article class="pk-panel">
              <header class="pk-panel-head"><h3>Cupos de tu plan</h3><small>Por rol</small></header>
              <app-role-quota-summary [refreshTrigger]="refreshTrigger" [showHint]="true"></app-role-quota-summary>
              <header class="pk-panel-head" style="margin-top: 1rem"><h3>Usuarios por rol</h3><small>{{ d.total }} en total</small></header>
              <div class="pk-split" *ngIf="d.total"><span *ngFor="let r of d.byRole" [style.flex-grow]="r.count" [style.background]="r.color" [title]="r.label"></span></div>
              <ul class="pk-legend">
                <li *ngFor="let r of d.byRole"><span class="sw" [style.background]="r.color"></span><span class="ln">{{ r.label }}</span><strong>{{ r.count }}</strong></li>
              </ul>
            </article>
            <article class="pk-panel">
              <header class="pk-panel-head"><h3>Requiere atención</h3><span class="pk-count" *ngIf="attention.length">{{ attention.length }}</span></header>
              <app-pk-attention [items]="attention" emptyText="Todos los usuarios están activos y con un rol asignado."></app-pk-attention>
              <header class="pk-panel-head" style="margin-top: 1rem"><h3>Últimos en unirse</h3></header>
              <ul class="pk-feed" style="grid-template-columns: 1fr" *ngIf="d.newest.length; else none">
                <li *ngFor="let u of d.newest; trackBy: byId">
                  <span class="fi in"><svg viewBox="0 0 16 16"><use xlink:href="./assets/icons/bootstrap-icons.svg#person-plus-fill"/></svg></span>
                  <span class="fb"><strong>{{ u.name }}</strong><small>{{ u.role }}</small></span>
                  <time>{{ relativeTime(u.at) }}</time>
                </li>
              </ul>
              <ng-template #none><p class="pk-empty">Aún no hay usuarios.</p></ng-template>
            </article>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-wrapper { background: #f8f9fa; }
    .page-subtitle-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.5rem; background: white; border-bottom: 1px solid #e9ecef; }
    .page-subtitle { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: #6E6E6E; }
    .page-subtitle svg { width: 16px; height: 16px; fill: #6E6E6E; }
    .header-actions { display: flex; align-items: center; gap: 0.75rem; }
    .action-link { display: flex; align-items: center; gap: 0.4rem; color: #6c757d; font-size: 15px; font-weight: 500; text-decoration: none; white-space: nowrap; border-bottom: 1px solid transparent; padding: 0.25rem 0; transition: color 0.2s ease, border-color 0.2s ease; }
    .action-link svg { width: 15px; height: 15px; fill: #6c757d; flex-shrink: 0; }
    .action-link.action-link-primary { color: #0066cc; }
    .action-link.action-link-primary svg { fill: #0066cc; }
    .action-link.action-link-primary:hover { color: #004a99; border-bottom-color: #004a99; }
    .dashboard-container { padding: 1.25rem 1.5rem; }
  `],
})
export class UsersDashboardComponent extends LivePanel<UsersSummary> implements OnChanges {
  @Input() refreshTrigger = 0;
  @Output() openCreateModal = new EventEmitter<void>();
  attention: PkAttention[] = [];

  constructor(private customersService: CustomersService) {
    super();
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['refreshTrigger'] && !c['refreshTrigger'].firstChange) this.refresh();
  }

  protected fetch(): Observable<UsersSummary> {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken');
    const payload = token ? decodeJwtPayload(token) : null;
    const tenantId: string | null = payload?.tenantId || payload?.basicDataId || null;
    if (!tenantId) return of(this.summarize([]));
    // Mismo alcance que la lista de usuarios: los del contrato de InOut
    return this.customersService.getTenantContract(tenantId).pipe(
      map((c: any) => c?.contractId || undefined),
      catchError(() => of(undefined)),
      switchMap((contractId) => this.customersService.getDependentsWithRoles(tenantId, contractId)),
      map((deps) => this.summarize(deps || [])),
    );
  }

  private summarize(deps: any[]): UsersSummary {
    const roleNames = (d: any): string[] => (d.roles || []).map((r: any) => r.name || r.strName).filter(Boolean);
    const isClientOnly = (d: any) => { const r = roleNames(d); return r.length > 0 && r.every((n) => n === 'clienteInout'); };
    const staff = deps.filter((d) => !isClientOnly(d));
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const SINGULAR: Record<string, string> = { adminInout: 'Administrador', operatorInout: 'Operador', viewerInout: 'Visor', clienteInout: 'Cliente' };
    const label = (d: any) => SINGULAR[ROLES.find((x) => roleNames(d).includes(x.key))?.key || ''] || 'Sin rol';
    return {
      total: deps.length,
      staff: staff.length,
      active: staff.filter((d) => d.isActive).length,
      inactive: staff.filter((d) => !d.isActive).length,
      clients: deps.length - staff.length,
      newThisMonth: deps.filter((d) => d.createdAt && new Date(d.createdAt) >= monthStart).length,
      signers: staff.filter((d) => d.isAuthorizedSigner).length,
      noRole: deps.filter((d) => roleNames(d).length === 0).length,
      byRole: ROLES.map((r) => ({ ...r, count: deps.filter((d) => roleNames(d).includes(r.key)).length })),
      newest: deps.filter((d) => d.createdAt).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5).map((d) => ({
        id: d.userId, at: d.createdAt, role: label(d),
        name: d.businessName || [d.firstName, d.firstSurname].filter(Boolean).join(' ') || d.email,
      })),
    };
  }

  protected override onData(d: UsersSummary): void {
    const a: PkAttention[] = [];
    if (d.inactive) a.push({ icon: 'person-x-fill', tone: 'warning', count: d.inactive, label: 'Usuarios inactivos', detail: 'No pueden entrar: reactívalos o retíralos del equipo', link: '/users' });
    if (d.noRole) a.push({ icon: 'person-exclamation', tone: 'info', count: d.noRole, label: 'Sin rol asignado', detail: 'Asígnales un rol para que puedan trabajar', link: '/users' });
    if (!d.signers && d.staff) a.push({ icon: 'pen-fill', tone: 'info', count: 0, label: 'Sin firmante autorizado', detail: 'Define quién firma contratos del negocio', link: '/users' });
    this.attention = a;
  }

  byId = (_: number, a: { id: string }) => a.id;
}
