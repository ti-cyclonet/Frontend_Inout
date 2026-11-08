import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReferenceCheck {
  used: boolean;
  message: string | null;
}

/**
 * ¿La referencia de un soporte de pago ya se usó en otra transacción del
 * negocio? (ventas, pedidos, cartera, reservas). El servidor lo vuelve a
 * validar al guardar; esto es para avisar antes.
 */
@Injectable({ providedIn: 'root' })
export class PaymentReferencesService {
  constructor(private http: HttpClient) {}

  check(reference: string): Observable<ReferenceCheck> {
    const ref = (reference || '').trim();
    if (ref.replace(/[^A-Za-z0-9]/g, '').length < 4) return of({ used: false, message: null });
    return this.http.get<ReferenceCheck>(`${environment.apiUrl}/payment-references/check`, { params: { ref } })
      .pipe(catchError(() => of({ used: false, message: null })));
  }
}
