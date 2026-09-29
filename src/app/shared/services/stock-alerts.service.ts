import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval } from 'rxjs';
import { tap, switchMap, startWith } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface StockAlert {
  id: string;
  code: string;
  name: string;
  type: 'product' | 'material';
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  severity: 'critical' | 'warning';
}

export interface StockAlertsResponse {
  data: StockAlert[];
  totalAlerts: number;
  criticalCount: number;
  warningCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class StockAlertsService {
  private apiUrl = `${environment.apiUrl}/stock/alerts`;
  private alertsSubject = new BehaviorSubject<StockAlertsResponse>({
    data: [],
    totalAlerts: 0,
    criticalCount: 0,
    warningCount: 0,
  });

  alerts$ = this.alertsSubject.asObservable();

  constructor(private http: HttpClient) {}

  getAlerts(): Observable<StockAlertsResponse> {
    return this.http.get<StockAlertsResponse>(this.apiUrl).pipe(
      tap(response => this.alertsSubject.next(response))
    );
  }

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Recalcula las alertas agrupando llamadas seguidas (una pantalla puede
   * guardar varias cosas a la vez): se consulta una sola vez tras 600 ms.
   */
  scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.refreshAlerts();
    }, 600);
  }

  refreshAlerts(): void {
    this.http.get<StockAlertsResponse>(this.apiUrl).subscribe({
      next: (response) => this.alertsSubject.next(response),
      error: () => {},
    });
  }

  getAlertCount(): number {
    return this.alertsSubject.value.totalAlerts;
  }

  getCriticalCount(): number {
    return this.alertsSubject.value.criticalCount;
  }
}
