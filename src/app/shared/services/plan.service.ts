import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/** Plan tal como lo publica Authoriza para la landing de InOut. */
export interface PlanOffer {
  packageId: string;
  displayName: string;
  name: string;
  description: string | null;
  price: number;
  annualPrice: number | null;
  isHighlighted: boolean;
  badge: string | null;
  features: string[];
  ctaType: string;
}

/** Cambio de plan en firma: el plan actual sigue vigente hasta que se active. */
export interface PendingUpgrade {
  contractCode: string;
  packageName: string;
  requestedAt: string;
  issued: boolean;
  adminSigned: boolean;
  clientSigned: boolean;
}

export type BillingCycle = 'monthly' | 'annual';

/** Versiones vigentes de los documentos que se aceptan al contratar (las mismas de la landing). */
export const PLAN_LEGAL = {
  termsVersion: 'inout-servicio-2026-09-25',
  habeasDataVersion: 'cyclonet-datos-2026-09-25',
  termsUrl: 'https://cyclonet.com.co/legal/terminos-inout.html',
  habeasDataUrl: 'https://cyclonet.com.co/legal/tratamiento-datos.html',
};

export const FACTONET_URL = environment.production ? 'https://billing.cyclonet.com.co' : 'http://localhost:4202';

/** Días antes del fin de la prueba en que se invita a cambiar de plan. */
export const TRIAL_NOTICE_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class PlanService {
  private authorizaUrl = environment.auth.authorizaUrl;

  constructor(private http: HttpClient) {}

  getPlans(): Observable<PlanOffer[]> {
    return this.http.get<PlanOffer[]>(`${this.authorizaUrl}/packages/landing`, { params: { application: 'Inout' } });
  }

  getPendingUpgrade(): Observable<{ pending: PendingUpgrade | null }> {
    return this.http.get<{ pending: PendingUpgrade | null }>(`${this.authorizaUrl}/auth/plan/pending-upgrade`, { params: { application: 'Inout' } });
  }

  private readonly upgradedSubject = new Subject<void>();
  /** Se emite al pedir un cambio de plan (desbloquea una prueba vencida). */
  readonly upgraded$ = this.upgradedSubject.asObservable();

  upgrade(packageId: string, billingCycle: BillingCycle): Observable<{ success: boolean; message: string; contractCode?: string; pendingActivation?: boolean }> {
    return this.http.post<any>(`${this.authorizaUrl}/auth/plan/upgrade`, {
      packageId,
      billingCycle,
      acceptTerms: true,
      acceptHabeasData: true,
      termsVersion: PLAN_LEGAL.termsVersion,
      habeasDataVersion: PLAN_LEGAL.habeasDataVersion,
    }).pipe(tap((res) => { if (res?.success) this.upgradedSubject.next(); }));
  }

  /** Precio anual: el del paquete o, si no tiene, 12 meses con 5% de descuento (como en la landing). */
  annualPrice(plan: PlanOffer): number {
    return plan.annualPrice && plan.annualPrice > 0 ? plan.annualPrice : Math.round(plan.price * 12 * 0.95);
  }
}
