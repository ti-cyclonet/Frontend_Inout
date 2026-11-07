import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** Lo que la tienda muestra para reservar mesa. */
export interface DiningPublicInfo {
  enabled: boolean;
  preorderMode: 'none' | 'optional' | 'required';
  depositMode: 'none' | 'required';
  depositAmount: number;
  depositPerPerson: boolean;
  durationMinutes: number;
  toleranceMinutes: number;
  minLeadHours: number;
  maxDaysAhead: number;
  confirmMode: 'auto' | 'manual';
  maxPartySize: number;
  paymentInstructions: string | null;
}

export interface PublicSlot {
  start: string;
  end: string;
  available: boolean;
}

/** Reserva vista por el cliente (enlace privado). */
export interface PublicReservation {
  code: string;
  token: string;
  tenantId: string;
  status: 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
  statusLabel: string;
  startAt: string;
  endAt: string;
  partySize: number;
  customerName: string;
  notes: string | null;
  tables: { name: string; zone: string }[];
  deposit: { amount: number; status: 'PENDIENTE' | 'POR_VERIFICAR' | 'PAGADO' | 'RECHAZADO'; proofUrl: string | null; reference: string | null; instructions: string | null } | null;
  order: { code: string; token: string } | null;
  canCancel: boolean;
}

/** La reserva que se elige en el pago (comer en el local) o al reservar mesa. */
export interface DineInChoice {
  date: string;
  time: string;
  partySize: number;
}

@Injectable({ providedIn: 'root' })
export class DiningPublicService {
  private readonly url = `${environment.apiUrl}/dining/public`;

  constructor(private http: HttpClient) {}

  info(tenantId: string): Observable<DiningPublicInfo> {
    return this.http.get<DiningPublicInfo>(`${this.url}/${tenantId}`);
  }
  availability(tenantId: string, date: string, party: number): Observable<{ slots: PublicSlot[]; tooLarge?: boolean }> {
    return this.http.get<{ slots: PublicSlot[]; tooLarge?: boolean }>(`${this.url}/${tenantId}/availability`, { params: { date, party: String(party) } });
  }
  book(tenantId: string, body: Record<string, any>): Observable<PublicReservation> {
    return this.http.post<PublicReservation>(`${this.url}/${tenantId}/reservations`, body);
  }
  view(token: string): Observable<PublicReservation> {
    return this.http.get<PublicReservation>(`${this.url}/reservation/${token}`);
  }
  cancel(token: string): Observable<PublicReservation> {
    return this.http.post<PublicReservation>(`${this.url}/reservation/${token}/cancel`, {});
  }
  uploadDeposit(token: string, file: File, reference: string): Observable<PublicReservation> {
    const form = new FormData();
    form.append('proof', file);
    if (reference) form.append('reference', reference);
    return this.http.post<PublicReservation>(`${this.url}/reservation/${token}/deposit`, form);
  }
}

/** Próximos días para reservar: [{ value: 'YYYY-MM-DD', label: 'Hoy' | 'mar 10' }]. */
export function bookingDays(maxDaysAhead: number, now = new Date()): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const p = (n: number) => String(n).padStart(2, '0');
  for (let i = 0; i <= Math.min(maxDaysAhead, 60); i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
    const value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const label = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
    out.push({ value, label });
  }
  return out;
}

export function slotTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function slotLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

/** Valor del anticipo para un grupo. */
export function depositOf(info: DiningPublicInfo | null, party: number): number {
  if (!info || info.depositMode !== 'required') return 0;
  return info.depositPerPerson ? info.depositAmount * Math.max(1, party) : info.depositAmount;
}
