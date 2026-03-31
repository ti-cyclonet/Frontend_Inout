import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.auth.authorizaUrl}/login`;
  private completeLoginUrl = `${environment.auth.authorizaUrl}/login/complete`;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  login(credentials: { email: string; password: string; applicationName?: string; contractId?: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, credentials);
  }

  completeLogin(data: { email: string; applicationName: string; contractId: string }): Observable<any> {
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
}
