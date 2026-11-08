import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Mensaje cuando CycloNet todavía no enciende los pagos en línea (igual al del backend). */
export const ONLINE_PAYMENTS_NOT_AVAILABLE =
  'Los pagos en línea con Mercado Pago están en configuración y todavía no están disponibles. Te avisaremos cuando puedas usarlos.';

export interface OnlinePaymentsStatus {
  available: boolean;
  provider: 'MERCADOPAGO';
  message: string | null;
  commissionPercent: number;
  account: {
    status: 'NOT_CONNECTED' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
    connected: boolean;
    providerUserId: string | null;
    connectedAt: string | null;
    enabledForStore: boolean;
    lastError: string | null;
  };
  notify: { requested: boolean; email: string | null; requestedAt: string | null };
}

export interface StoreOnlinePayments {
  available: boolean;
  inConfiguration: boolean;
  message: string | null;
}

export interface OrderOnlinePayment extends StoreOnlinePayments {
  amount: number;
}

/** Pagos en línea con la cuenta de Mercado Pago de cada negocio (backend: online-payments). */
@Injectable({ providedIn: 'root' })
export class OnlinePaymentsService {
  private readonly base = `${environment.apiUrl}/online-payments`;

  constructor(private http: HttpClient) {}

  // Negocio
  status(): Observable<OnlinePaymentsStatus> {
    return this.http.get<OnlinePaymentsStatus>(`${this.base}/status`);
  }

  notifyMe(email?: string): Observable<OnlinePaymentsStatus> {
    return this.http.post<OnlinePaymentsStatus>(`${this.base}/notify-me`, email ? { email } : {});
  }

  connectUrl(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.base}/mercadopago/connect`);
  }

  disconnect(): Observable<OnlinePaymentsStatus> {
    return this.http.post<OnlinePaymentsStatus>(`${this.base}/mercadopago/disconnect`, {});
  }

  setEnabledForStore(enabledForStore: boolean): Observable<OnlinePaymentsStatus> {
    return this.http.patch<OnlinePaymentsStatus>(`${this.base}/settings`, { enabledForStore });
  }

  // Tienda y seguimiento (públicos). Si falla, se toma como "no disponible".
  storeStatus(tenantId: string): Observable<StoreOnlinePayments> {
    return this.http.get<StoreOnlinePayments>(`${this.base}/store/${encodeURIComponent(tenantId)}`).pipe(
      catchError(() => of({ available: false, inConfiguration: true, message: ONLINE_PAYMENTS_NOT_AVAILABLE })),
    );
  }

  orderStatus(trackingToken: string): Observable<OrderOnlinePayment> {
    return this.http.get<OrderOnlinePayment>(`${this.base}/orders/${encodeURIComponent(trackingToken)}`).pipe(
      catchError(() => of({ available: false, inConfiguration: true, message: ONLINE_PAYMENTS_NOT_AVAILABLE, amount: 0 })),
    );
  }

  checkout(trackingToken: string): Observable<{ url: string; amount: number }> {
    return this.http.post<{ url: string; amount: number }>(`${this.base}/orders/${encodeURIComponent(trackingToken)}/checkout`, {});
  }
}
