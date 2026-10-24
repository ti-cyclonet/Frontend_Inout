import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TaxInfo { label: 'IVA' | 'INC'; percent: number }

/** Impuesto sobre un subtotal, redondeado al centavo (igual que el backend). */
export function taxOn(subtotal: number, percent: number): number {
  return Math.round((Number(subtotal) || 0) * (Number(percent) || 0)) / 100;
}

/** Texto del impuesto en documentos guardados, a partir de sus valores. */
export function taxLabelFor(subtotal: number, tax: number, label = 'IVA'): string {
  const pct = subtotal > 0 ? Math.round((tax / subtotal) * 1000) / 10 : 0;
  return `${label} (${String(pct).replace('.', ',')}%)`;
}

/**
 * Impuesto del período activo del negocio: el INC (restaurantes) manda sobre
 * el IVA y, si no hay parámetro configurado, no hay impuesto. El backend
 * calcula el mismo valor al guardar; aquí solo se muestra antes de confirmar.
 */
@Injectable({ providedIn: 'root' })
export class TaxService {
  constructor(private http: HttpClient) {}

  info(): Observable<TaxInfo> {
    return this.http.get<any>(`${environment.apiUrl}/business-params`).pipe(
      map((p) => {
        const inc = Number(p?.INC_PORCENTAJE) || 0;
        return inc > 0 ? { label: 'INC' as const, percent: inc } : { label: 'IVA' as const, percent: Number(p?.IVA_PORCENTAJE) || 0 };
      }),
      catchError(() => of({ label: 'IVA' as const, percent: 0 })),
    );
  }
}
