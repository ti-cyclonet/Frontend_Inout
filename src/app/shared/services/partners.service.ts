import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { decodeJwtPayload } from '../utils/jwt.util';

export interface PartnerOffer {
  id: string;
  name: string;
  category: string;
  description: string;
  benefit: string | null;
  logoUrl: string | null;
  isAffiliate: boolean;
}

export const PARTNER_CATEGORIES: Record<string, string> = {
  facturacion: 'Facturación electrónica', contabilidad: 'Contabilidad', pagos: 'Pagos y datáfonos', hardware: 'Equipos para tu punto de venta',
  mensajeria: 'Mensajería y WhatsApp', domicilios: 'Domicilios', web: 'Dominio y página web', otros: 'Otros servicios',
};

/**
 * Servicios recomendados por CycloNet (aliados). El catálogo lo administra
 * Authoriza; cada clic pasa por Authoriza, que lo cuenta y lleva al aliado.
 */
@Injectable({ providedIn: 'root' })
export class PartnersService {
  private http = inject(HttpClient);
  private readonly base = `${environment.auth.authorizaUrl}/partners`;
  private catalog$?: Observable<PartnerOffer[]>;

  /** Solo el administrador del negocio ve las recomendaciones. */
  get canSee(): boolean {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('user_rol') === 'adminInout';
  }

  /** Catálogo completo (una sola consulta por sesión de la página). */
  catalog(): Observable<PartnerOffer[]> {
    this.catalog$ ??= this.http.get<PartnerOffer[]>(`${this.base}/public`, { params: { app: 'inout' } }).pipe(
      catchError(() => of([] as PartnerOffer[])),
      shareReplay(1),
    );
    return this.catalog$;
  }

  /** Servicios sugeridos en una pantalla (ventas, cartera, inicio…). */
  forPlacement(placement: string): Observable<PartnerOffer[]> {
    return this.http.get<PartnerOffer[]>(`${this.base}/public`, { params: { app: 'inout', placement } }).pipe(
      catchError(() => of([] as PartnerOffer[])),
      map((r) => r || []),
    );
  }

  /** Enlace que cuenta el clic (con el negocio) y lleva al aliado. */
  goUrl(offer: PartnerOffer, placement = 'catalogo'): string {
    const params = new URLSearchParams({ app: 'inout', placement });
    const tenant = this.tenantId();
    if (tenant) params.set('t', tenant);
    return `${this.base}/go/${encodeURIComponent(offer.id)}?${params}`;
  }

  private tenantId(): string | null {
    const token = sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('token') || '';
    const payload = token ? decodeJwtPayload(token) : null;
    return payload?.tenantId ? String(payload.tenantId) : null;
  }
}
