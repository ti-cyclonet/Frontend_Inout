import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TableShape = 'square' | 'round' | 'rect';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';

export interface DiningTable {
  id: string;
  name: string;
  zone: string;
  seats: number;
  shape: TableShape;
  posX: number;
  posY: number;
  joinable: boolean;
}

export interface Reservation {
  id: string;
  code: string;
  tableIds: string[];
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  partySize: number;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  source: 'STAFF' | 'WALK_IN' | 'MARKETPLACE';
  notes: string | null;
  orderId: string | null;
  seatedAt: string | null;
  /** Anticipo de una reserva de la tienda. */
  depositAmount: number | string | null;
  depositStatus: 'PENDIENTE' | 'POR_VERIFICAR' | 'PAGADO' | 'RECHAZADO' | null;
  depositProofUrl: string | null;
  depositReference: string | null;
  trackingToken: string | null;
}

export interface DiningSettings {
  durationMinutes: number;
  toleranceMinutes: number;
  slotMinutes: number;
  minLeadHours: number;
  maxDaysAhead: number;
  confirmMode: 'auto' | 'manual';
  depositMode: 'none' | 'required';
  depositAmount: number;
  depositPerPerson: boolean;
  preorderMode: 'none' | 'optional' | 'required';
  onlineEnabled: boolean;
}

export interface DiningSlot {
  start: string;
  end: string;
  available: boolean;
  reason?: 'PASADA' | 'ANTICIPACION' | 'LLENA';
  tableId?: string;
  tableName?: string;
}

export interface ReservationInput {
  tableIds?: string[];
  partySize?: number;
  date?: string;
  time?: string;
  durationMinutes?: number;
  customerName?: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  notes?: string | null;
  walkIn?: boolean;
}

/** Mesas y reservas del negocio (módulo Mesas). */
@Injectable({ providedIn: 'root' })
export class DiningService {
  private readonly url = `${environment.apiUrl}/dining`;

  constructor(private http: HttpClient) {}

  settings(): Observable<DiningSettings> {
    return this.http.get<DiningSettings>(`${this.url}/settings`);
  }
  saveSettings(s: Partial<DiningSettings>): Observable<DiningSettings> {
    return this.http.patch<DiningSettings>(`${this.url}/settings`, s);
  }

  tables(): Observable<DiningTable[]> {
    return this.http.get<DiningTable[]>(`${this.url}/tables`);
  }
  createTable(t: Partial<DiningTable>): Observable<DiningTable> {
    return this.http.post<DiningTable>(`${this.url}/tables`, t);
  }
  updateTable(id: string, t: Partial<DiningTable>): Observable<DiningTable> {
    return this.http.patch<DiningTable>(`${this.url}/tables/${id}`, t);
  }
  removeTable(id: string): Observable<unknown> {
    return this.http.delete(`${this.url}/tables/${id}`);
  }
  saveLayout(tables: { id: string; posX: number; posY: number }[]): Observable<DiningTable[]> {
    return this.http.put<DiningTable[]>(`${this.url}/tables/layout`, { tables });
  }

  reservations(date: string): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(`${this.url}/reservations`, { params: { date } });
  }
  availability(date: string, party: number): Observable<{ slots: DiningSlot[] }> {
    return this.http.get<{ slots: DiningSlot[] }>(`${this.url}/availability`, { params: { date, party: String(party) } });
  }
  createReservation(r: ReservationInput): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.url}/reservations`, r);
  }
  updateReservation(id: string, r: ReservationInput): Observable<Reservation> {
    return this.http.patch<Reservation>(`${this.url}/reservations/${id}`, r);
  }
  reviewDeposit(id: string, approve: boolean): Observable<Reservation> {
    return this.http.patch<Reservation>(`${this.url}/reservations/${id}/deposit`, { approve });
  }
  setStatus(id: string, status: ReservationStatus, reason?: string): Observable<Reservation> {
    return this.http.patch<Reservation>(`${this.url}/reservations/${id}/status`, { status, reason });
  }
}
