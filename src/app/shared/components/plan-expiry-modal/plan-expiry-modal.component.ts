import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { UsageStatusService } from '../../services/usage-status.service';
import { PermissionsService } from '../../services/permissions.service';
import { PlanService, TRIAL_NOTICE_DAYS } from '../../services/plan.service';

/**
 * Aviso de fin del periodo de prueba. Al administrador de una cuenta en plan
 * de prueba (no facturable, con vigencia) le aparece cuando quedan
 * TRIAL_NOTICE_DAYS días o menos, o ya venció, y lo lleva a /plan.
 * Se muestra como mucho una vez al día y nunca si ya pidió el cambio.
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
  daysRemaining = 0;
  packageName = '';
  endDate: Date | null = null;

  private sub?: Subscription;

  get endLabel(): string {
    return this.endDate ? this.endDate.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : '';
  }

  constructor(
    private usageStatus: UsageStatusService,
    private plans: PlanService,
    private permissions: PermissionsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (typeof window === 'undefined' || !this.permissions.isAdmin || this.snoozedToday()) return;
    this.usageStatus.getUsageStatus().subscribe({
      next: (status) => {
        const t = status.planTimeline;
        if (status.isBillable || !t) return;
        const end = new Date(t.endDate);
        const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
        if (days > TRIAL_NOTICE_DAYS) return;
        this.plans.getPendingUpgrade().subscribe({
          next: ({ pending }) => {
            if (pending) return;
            this.packageName = status.packageName;
            this.endDate = end;
            this.expired = days <= 0;
            this.daysRemaining = Math.max(0, days);
            this.showUnlessOnPlanPage();
          },
          error: () => {},
        });
      },
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** En /plan no hace falta el aviso: ya está donde lo mandaría. */
  private showUnlessOnPlanPage(): void {
    const onPlan = () => this.router.url.startsWith('/plan');
    if (!onPlan()) { this.open = true; return; }
    this.sub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      if (!onPlan() && !this.snoozedToday()) { this.open = true; this.sub?.unsubscribe(); }
    });
  }

  goToPlans(): void {
    this.close();
    this.router.navigate(['/plan']);
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (!this.open) return;
    this.open = false;
    try { localStorage.setItem(this.snoozeKey(), new Date().toDateString()); } catch { /* sin almacenamiento: vuelve a salir */ }
  }

  private snoozedToday(): boolean {
    try { return localStorage.getItem(this.snoozeKey()) === new Date().toDateString(); } catch { return false; }
  }

  private snoozeKey(): string {
    return `inout_plan_notice_${sessionStorage.getItem('user_id') || ''}`;
  }
}
