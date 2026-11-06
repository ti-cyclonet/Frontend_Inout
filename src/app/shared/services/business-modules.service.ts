import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ModuleKey = 'kitchen' | 'tables' | 'combos' | 'giftCards' | 'credit' | 'delivery';

export interface BusinessModule {
  key: ModuleKey;
  name: string;
  description: string;
  available: boolean;
  recommended: boolean;
  enabled: boolean;
  custom: boolean;
  appliesTo: string;
  blockedReason: string | null;
}

export interface BusinessModules {
  sector: string;
  sectorLabel: string;
  /** Cocina, Producción o Alistamiento, según el negocio. */
  kitchenLabel: string;
  modules: BusinessModule[];
}

/**
 * Funciones de mi negocio (Configuración). Mientras no se conocen, todo lo
 * que ya existía se muestra (así nadie pierde un menú si falla la consulta);
 * lo nuevo, como la pantalla de cocina, aparece solo si está activo.
 */
@Injectable({ providedIn: 'root' })
export class BusinessModulesService {
  private readonly url = `${environment.apiUrl}/business-modules`;
  private readonly state$ = new BehaviorSubject<BusinessModules | null>(null);
  private loading = false;
  /** Sesión de la que son los datos (otra sesión, otro negocio: se vuelven a pedir). */
  private session: string | null = null;

  constructor(private http: HttpClient) {}

  /** Módulos del negocio (se consultan una vez por sesión). */
  get modules$(): Observable<BusinessModules | null> {
    if (this.session !== this.currentSession()) this.reset();
    if (!this.state$.value && !this.loading) this.load();
    return this.state$.asObservable();
  }

  private currentSession(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('authToken') || sessionStorage.getItem('token');
  }

  load(): void {
    this.loading = true;
    this.session = this.currentSession();
    this.http.get<BusinessModules>(this.url).subscribe({
      next: (res) => { this.loading = false; this.state$.next(res); },
      error: () => { this.loading = false; },
    });
  }

  /** ¿Activo? Sin respuesta aún: lo existente sí, lo nuevo no. */
  isOn(key: ModuleKey, state = this.state$.value): boolean {
    const m = state?.modules.find((x) => x.key === key);
    if (!m) return key !== 'kitchen' && key !== 'tables';
    return m.enabled;
  }

  on$(key: ModuleKey): Observable<boolean> {
    return this.modules$.pipe(map((s) => this.isOn(key, s)));
  }

  set(key: ModuleKey, enabled: boolean): Observable<BusinessModules> {
    return this.http.patch<BusinessModules>(this.url, { key, enabled }).pipe(tap((res) => this.state$.next(res)));
  }

  reset(): void {
    this.session = this.currentSession();
    this.state$.next(null);
  }
}
