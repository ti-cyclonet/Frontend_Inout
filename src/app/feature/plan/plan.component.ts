import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { UsageStatusService } from '../../shared/services/usage-status.service';
import { PermissionsService } from '../../shared/services/permissions.service';
import { UsageStatusResponse } from '../../shared/model/usage-status.model';
import { BillingCycle, FACTONET_URL, PLAN_LEGAL, PendingUpgrade, PlanOffer, PlanService } from '../../shared/services/plan.service';

type Step = { icon: string; title: string; text: string; state: 'done' | 'current' | 'next' };

/**
 * Mi plan: el plan vigente, los planes de InOut (los mismos de la landing) y el
 * cambio de plan. Al pedirlo, Authoriza crea un contrato nuevo PENDING y el
 * plan actual sigue hasta que CycloNet y el cliente lo firmen en FactoNet.
 */
@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './plan.component.html',
  styleUrls: ['./plan.component.css'],
})
export class PlanComponent implements OnInit {
  loading = true;
  loadError = '';
  status: UsageStatusResponse | null = null;
  plans: PlanOffer[] = [];
  pending: PendingUpgrade | null = null;
  cycle: BillingCycle = 'monthly';

  daysRemaining = 0;
  expired = false;

  selected: PlanOffer | null = null;
  acceptTerms = false;
  acceptData = false;
  submitting = false;
  submitError = '';

  /** Plan recién pedido: se muestra la bienvenida con los pasos. */
  welcome: { plan: PlanOffer; cycle: BillingCycle; contractCode?: string } | null = null;

  readonly legal = PLAN_LEGAL;
  readonly factonetUrl = FACTONET_URL;

  constructor(
    private planService: PlanService,
    private usageStatus: UsageStatusService,
    public permissions: PermissionsService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = '';
    forkJoin({
      status: this.usageStatus.getUsageStatus().pipe(catchError(() => of(null))),
      plans: this.planService.getPlans(),
      pending: this.planService.getPendingUpgrade().pipe(catchError(() => of({ pending: null }))),
    }).subscribe({
      next: ({ status, plans, pending }) => {
        this.status = status;
        this.plans = (plans || []).filter((p) => p.price > 0 || p.ctaType === 'contact');
        this.pending = pending.pending;
        const end = status?.planTimeline ? new Date(status.planTimeline.endDate) : null;
        const days = end ? Math.ceil((end.getTime() - Date.now()) / 86400000) : 0;
        this.expired = !!end && days <= 0;
        this.daysRemaining = Math.max(0, days);
        this.loading = false;
      },
      error: () => {
        this.loadError = 'No pudimos cargar los planes. Revisa tu conexión e intenta de nuevo.';
        this.loading = false;
      },
    });
  }

  get isTrial(): boolean {
    return !!this.status && !this.status.isBillable && !!this.status.planTimeline;
  }

  isCurrent(plan: PlanOffer): boolean {
    const current = (this.status?.packageName || '').toLowerCase();
    return !!current && (plan.name || '').toLowerCase() === current;
  }

  price(plan: PlanOffer): number {
    return this.cycle === 'annual' ? this.planService.annualPrice(plan) : plan.price;
  }

  monthlyEquivalent(plan: PlanOffer): number {
    return Math.round(this.planService.annualPrice(plan) / 12);
  }

  money(n: number): string {
    return Math.round(n || 0).toLocaleString('es-CO');
  }

  longDate(d: string | Date): string {
    return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  }

  choose(plan: PlanOffer): void {
    if (plan.ctaType === 'contact') {
      window.open('https://cyclonet.com.co/inout/#contacto', '_blank', 'noopener');
      return;
    }
    this.selected = plan;
    this.acceptTerms = false;
    this.acceptData = false;
    this.submitError = '';
  }

  cancel(): void {
    if (!this.submitting) this.selected = null;
  }

  confirm(): void {
    if (!this.selected || !this.acceptTerms || !this.acceptData || this.submitting) return;
    const plan = this.selected;
    const cycle = this.cycle;
    this.submitting = true;
    this.submitError = '';
    this.planService.upgrade(plan.packageId, cycle).subscribe({
      next: (res) => {
        this.submitting = false;
        this.selected = null;
        this.welcome = { plan, cycle, contractCode: res.contractCode };
        setTimeout(() => document.querySelector('.pl-welcome')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        this.planService.getPendingUpgrade().pipe(catchError(() => of({ pending: null }))).subscribe((p) => (this.pending = p.pending));
      },
      error: (err) => {
        this.submitting = false;
        this.submitError = err?.error?.message || 'No se pudo solicitar el cambio de plan. Intenta de nuevo.';
      },
    });
  }

  /**
   * Pasos para completar la activación, con el avance real del contrato. La
   * firma del cliente es su aceptación al pedir el cambio: solo falta CycloNet.
   */
  get steps(): Step[] {
    const adminSigned = !!this.pending?.adminSigned;
    return [
      { icon: 'check2', title: 'Solicitud recibida', text: 'Registramos tu nuevo plan y generamos el contrato.', state: 'done' },
      {
        icon: 'pencil-square', title: 'Tu firma',
        text: 'Al aceptar los Términos y la autorización de datos firmaste el contrato. No tienes que hacer nada más.',
        state: 'done',
      },
      {
        icon: 'building-check', title: 'CycloNet revisa y firma',
        text: 'Nuestro equipo revisa tu contrato y lo firma. Te avisamos por correo.',
        state: adminSigned ? 'done' : 'current',
      },
      {
        icon: 'rocket-takeoff', title: 'Tu plan se activa solo',
        text: 'Con la firma de CycloNet el nuevo plan queda activo al instante. Tus facturas quedan en FactoNet para pagarlas en línea.',
        state: adminSigned ? 'done' : 'next',
      },
    ];
  }
}
