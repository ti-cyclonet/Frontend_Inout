import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PaymentType = 'CONTADO' | 'CREDITO';

/** Medios de pago de contado y de abonos (mismos códigos del backend). */
export const PAYMENT_METHODS: { value: string; label: string; icon: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: 'cash-coin' },
  { value: 'TRANSFERENCIA', label: 'Transferencia', icon: 'bank' },
  { value: 'TARJETA', label: 'Tarjeta', icon: 'credit-card' },
  { value: 'NEQUI', label: 'Nequi', icon: 'phone' },
  { value: 'DAVIPLATA', label: 'Daviplata', icon: 'phone' },
  { value: 'OTRO', label: 'Otro', icon: 'three-dots' },
];

export function paymentMethodLabel(value?: string | null): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label || value || '—';
}

export interface CreditEligibility {
  hasAccount: boolean;
  accountId: string | null;
  requestStatus: string | null;
  approvedLimit: number;
  termDays: number;
  outstanding: number;
  available: number;
  overdueCount: number;
  overdueAmount: number;
  eligible: boolean;
  reason: string | null;
}

export interface CreditSettings {
  id?: string;
  tenantId?: string;
  lateInterestMonthlyRate: number;
  graceDays: number;
  remindersEnabled: boolean;
  reminderDaysBefore: number;
  overdueReminderEveryDays: number;
  updatedAt?: string;
}

/** Crédito a clientes (flujo del cupo) y cartera (cuentas por cobrar y abonos). */
@Injectable({ providedIn: 'root' })
export class CreditService {
  private apiUrl = `${environment.apiUrl}/credit`;

  constructor(private http: HttpClient) {}

  // Cuentas de crédito
  listAccounts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/accounts`);
  }
  createRequest(data: { customerId: string; customerName: string; customerEmail?: string; requestedAmount: number; requestedTermDays: number; notes?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/accounts`, data);
  }
  validate(id: string, data: { identityVerified: boolean; referencesVerified: boolean; paymentCapacityVerified: boolean; meetsRequirements: boolean; observations?: string }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/accounts/${id}/validate`, data);
  }
  assign(id: string, data: { limit: number; termDays: number }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/accounts/${id}/assign`, data);
  }
  decide(id: string, data: { approve: boolean; reason?: string }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/accounts/${id}/decision`, data);
  }
  setSuspended(id: string, data: { suspended: boolean; reason?: string }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/accounts/${id}/suspension`, data);
  }

  // Venta a crédito
  eligibility(customerId: string): Observable<CreditEligibility> {
    return this.http.get<CreditEligibility>(`${this.apiUrl}/customers/${customerId}/eligibility`);
  }
  statement(customerId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/customers/${customerId}/statement`);
  }

  // Cartera
  summary(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/portfolio/summary`);
  }
  listReceivables(filters: { customerId?: string; status?: string; overdue?: boolean } = {}): Observable<any[]> {
    const params: any = {};
    if (filters.customerId) params.customerId = filters.customerId;
    if (filters.status) params.status = filters.status;
    if (filters.overdue) params.overdue = 'true';
    return this.http.get<any[]>(`${this.apiUrl}/receivables`, { params });
  }
  getReceivable(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/receivables/${id}`);
  }
  registerPayment(id: string, data: { amount: number; method: string; reference?: string; paymentDate?: string; notes?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/receivables/${id}/payments`, data);
  }
  voidReceivable(id: string, reason: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/receivables/${id}/void`, { reason });
  }
  /** Envía por correo el recordatorio de pago de esa cuenta al cliente. */
  remind(id: string): Observable<{ sent: boolean; email?: string; reason?: string }> {
    return this.http.post<{ sent: boolean; email?: string; reason?: string }>(`${this.apiUrl}/receivables/${id}/remind`, {});
  }

  // Configuración: intereses de mora y recordatorios
  getSettings(): Observable<CreditSettings> {
    return this.http.get<CreditSettings>(`${this.apiUrl}/settings`);
  }
  updateSettings(data: Omit<CreditSettings, 'id' | 'tenantId' | 'updatedAt'>): Observable<CreditSettings> {
    return this.http.patch<CreditSettings>(`${this.apiUrl}/settings`, data);
  }
}
