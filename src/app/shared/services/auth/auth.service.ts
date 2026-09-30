import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, of, catchError } from 'rxjs';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.auth.authorizaUrl}/auth/login`;
  private completeLoginUrl = `${environment.auth.authorizaUrl}/auth/login/complete`;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  login(credentials: { email: string; password: string; applicationName?: string; contractId?: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, credentials);
  }

  completeLogin(data: { email: string; applicationName: string; contractId: string; selectionToken?: string }): Observable<any> {
    return this.http.post<any>(this.completeLoginUrl, data);
  }

  setUserSession(userData: any): void {
    if (isPlatformBrowser(this.platformId)) {
      const token = userData.access_token || 'temp_token';
      
      sessionStorage.setItem('authToken', token);
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user_id', userData.user?.id || '');
      sessionStorage.setItem('user_email', userData.user?.email || '');
      sessionStorage.setItem('user_name', userData.user?.name || '');
      sessionStorage.setItem('user_rol', userData.user?.rol || '');
      sessionStorage.setItem('user_rolDescription', userData.user?.rolDescription || '');
      sessionStorage.setItem('user_image', userData.user?.image || '');
      sessionStorage.setItem('must_change_password', userData.user?.mustChangePassword ? 'true' : 'false');

      // Guardar nombre real del usuario (razón social o nombre + apellido)
      const displayName = userData.user?.businessName 
        || (userData.user?.firstName ? `${userData.user.firstName} ${userData.user.secondName || ''}`.trim() : '')
        || '';
      sessionStorage.setItem('user_displayName', displayName);
      
      // Guardar codePrefix del contrato
      if (userData.contract?.codePrefix) {
        sessionStorage.setItem('codePrefix', userData.contract.codePrefix);
      }
      
      if (userData.contracts) {
        sessionStorage.setItem('user_contracts', JSON.stringify(userData.contracts));
      }
    }
  }

  logout() {
    localStorage.removeItem('authToken');
    sessionStorage.clear();
  }

  isAuthenticated(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return !!sessionStorage.getItem('authToken');
    }
    return false;
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return sessionStorage.getItem('authToken');
    }
    return null;
  }

  /** Segundos que le quedan al token actual (0 si no hay token o no se puede leer). */
  tokenSecondsLeft(): number {
    const token = this.getToken();
    if (!token) return 0;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return Math.max(0, Math.floor(payload.exp - Date.now() / 1000));
    } catch {
      return 0;
    }
  }

  /**
   * Renueva el token con Authoriza si le quedan menos de `thresholdSeconds`
   * (pantallas que quedan abiertas, como el Dashboard). Authoriza revalida al
   * usuario y su rol, acepta un token recién vencido y limita la sesión a 12 h.
   */
  renewSessionIfNeeded(thresholdSeconds = 15 * 60): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId) || !this.getToken() || this.tokenSecondsLeft() > thresholdSeconds) {
      return of(true);
    }
    return this.http.post<{ access_token: string }>(`${environment.auth.authorizaUrl}/auth/renew`, {}).pipe(
      tap((r) => {
        if (r?.access_token) {
          sessionStorage.setItem('authToken', r.access_token);
          sessionStorage.setItem('token', r.access_token);
        }
      }),
      map(() => true),
      catchError(() => of(false)),
    );
  }

  /** El token ya venció y no se pudo renovar. */
  sessionExpired(): boolean {
    return !!this.getToken() && this.tokenSecondsLeft() === 0;
  }
}
