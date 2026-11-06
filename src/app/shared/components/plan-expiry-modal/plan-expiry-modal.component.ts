import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { UsageStatusService } from '../../services/usage-status.service';
import { PermissionsService } from '../../services/permissions.service';
import { PlanService, TRIAL_NOTICE_DAYS } from '../../services/plan.service';

/**
 * Aviso de fin del periodo de prueba (plan no facturable con vigencia).
 *
 * - Faltan TRIAL_NOTICE_DAYS días o menos: aviso al administrador, que puede
 *   cerrarlo (sale como mucho una vez al día).
 * - Ya venció y no hay un cambio de plan en curso: InOut queda bloqueado. El
 *   aviso no se puede cerrar; el administrador solo puede ir a /plan y los
 *   demás usuarios, cerrar sesión. Al pedir el cambio de plan se desbloquea
 *   y sigue con el plan gratis mientras se activa el nuevo.
 *
 * Los clientes del MarketPlace (clienteInout) no son del equipo del negocio:
 * a ellos no se les muestra.
 */
@Component({
  selector: 'app-plan-expiry-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plan-expiry-modal.component.html',
  styleUrls: ['./plan-expiry-modal.component.css'],
})
export class PlanExpiryModalComponent implements OnInit, OnDestroy {
  open = false;
  expired = false;
  /** Prueba vencida sin cambio de plan: no se puede cerrar. */
  locked = false;
  daysRemaining = 0;
  packageName = '';
  endDate: Date | null = null;

  private subs: Subscription[] = [];

  get endLabel(): string {
    return this.endDate ? this.endDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : '';
  }

  /** Solo el administrador puede cambiar el plan. */
  get canUpgrade(): boolean {
    return this.permissions.isAdmin;
  }

  constructor(
    private usageStatus: UsageStatusService,
    private plans: PlanService,
    private permissions: PermissionsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (typeof window === 'undefined' || sessionStorage.getItem('user_rol') === 'clienteInout') return;
    // Al pedir el cambio de plan, se puede seguir usando InOut
    this.subs.push(this.plans.upgraded$.subscribe(() => this.unlock()));
    this.usageStatus.getUsageStatus().subscribe({
      next: (status) => {
        const t = status.planTimeline;
        if (status.isBillable || !t) return;
        const end = new Date(t.endDate);
        const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
        const expired = days <= 0;
        if (days > TRIAL_NOTICE_DAYS) return;
        // El aviso previo es solo para el administrador y se puede posponer
        if (!expired && (!this.canUpgrade || this.snoozedToday())) return;
        this.plans.getPendingUpgrade().subscribe({
          next: ({ pending }) => {
            if (pending) return;
            this.packageName = status.packageName;
            this.endDate = end;
            this.expired = expired;
            this.locked = expired;
            this.daysRemaining = Math.max(0, days);
            this.watchRoute();
          },
          error: () => {},
        });
      },
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  /**
   * En /plan no se muestra (el administrador está eligiendo plan). Bloqueado,
   * vuelve a salir en cualquier otra pantalla.
   */
  private watchRoute(): void {
    const update = () => {
      const onPlan = this.canUpgrade && this.router.url.startsWith('/plan');
      if (this.locked) this.open = !onPlan;
      else if (!onPlan && !this.snoozedToday()) this.open = true;
    };
    update();
    this.subs.push(this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(update));
  }

  goToPlans(): void {
    if (!this.locked) this.close();
    this.open = false;
    this.router.navigate(['/plan']);
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (!this.open || this.locked) return;
    this.open = false;
    try { localStorage.setItem(this.snoozeKey(), new Date().toDateString()); } catch { /* sin almacenamiento: vuelve a salir */ }
  }

  logout(): void {
    sessionStorage.clear();
    this.router.navigate(['/login']).then(() => setTimeout(() => window.location.reload(), 100));
  }

  private unlock(): void {
    this.locked = false;
    this.open = false;
    this.subs.slice(1).forEach((s) => s.unsubscribe());
    this.subs = this.subs.slice(0, 1);
  }

  private snoozedToday(): boolean {
    try { return localStorage.getItem(this.snoozeKey()) === new Date().toDateString(); } catch { return false; }
  }

  private snoozeKey(): string {
    return `inout_plan_notice_${sessionStorage.getItem('user_id') || ''}`;
  }
}
