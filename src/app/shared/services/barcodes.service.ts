import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/** Tipos de ítem con código de barras (los kits se guardan como combo). */
export type BarcodeItemType = 'product' | 'material' | 'material_t' | 'combo';

export interface BarcodeRow {
  code: string;
  itemType: BarcodeItemType;
  itemId: string;
}

@Injectable({ providedIn: 'root' })
export class BarcodesService {
  private readonly url = `${environment.apiUrl}/barcodes`;

  constructor(private http: HttpClient) {}

  /** Todos los códigos del negocio (la venta los resuelve sin ir al servidor). */
  getAll(): Observable<BarcodeRow[]> {
    return this.http.get<BarcodeRow[]>(this.url);
  }

  /** Dueño de un código; 404 si no es de nadie. */
  lookup(code: string): Observable<BarcodeRow & { itemName: string }> {
    return this.http.get<BarcodeRow & { itemName: string }>(`${this.url}/lookup/${encodeURIComponent(code)}`);
  }

  forItem(itemType: BarcodeItemType, itemId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.url}/${itemType}/${itemId}`);
  }

  /** Reemplaza los códigos del ítem; 409 si alguno ya es de otro ítem. */
  set(itemType: BarcodeItemType, itemId: string, codes: string[]): Observable<string[]> {
    return this.http.put<string[]>(`${this.url}/${itemType}/${itemId}`, { codes });
  }

  /**
   * Guarda los códigos después de guardar el ítem. Devuelve el aviso para
   * mostrar si no se pudieron guardar (o null). Con `codes` null (no se
   * alcanzaron a cargar) no toca nada, para no borrar los que ya tenía.
   */
  saveAfter(itemType: BarcodeItemType, itemId: string | null | undefined, codes: string[] | null): Observable<string | null> {
    if (!itemId || codes === null) return of(null);
    return this.set(itemType, itemId, codes).pipe(
      map(() => null),
      catchError((err) => of(typeof err?.error?.message === 'string' ? err.error.message : 'No se pudieron guardar los códigos de barras.')),
    );
  }
}

/** Igual que el backend: sin espacios ni caracteres de control, ASCII de 3 a 64. */
export function normalizeBarcode(raw: string): string | null {
  const code = String(raw ?? '').replace(/[\s\u0000-\u001f\u007f]+/g, '');
  return code.length >= 3 && code.length <= 64 && /^[\x21-\x7e]+$/.test(code) ? code : null;
}
