import { Injectable, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth/login';

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post<{ access_token: string; email: string; name: string; rol: string; image: string }>(
      this.apiUrl,
      credentials      
    ).pipe(
      tap(response => {        
        if (isPlatformBrowser(this.platformId)) {
          this.setUserSession(response);
        }
      })
    );
  }

  setUserSession(userData: any): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem('authToken', userData.access_token);
      sessionStorage.setItem('user_id', userData.user.id);
      sessionStorage.setItem('user_email', userData.user.email);
      sessionStorage.setItem('user_name', userData.user.name);
      sessionStorage.setItem('user_rol', userData.user.rol);
      sessionStorage.setItem('user_rolDescription', userData.user.rolDescription);
      sessionStorage.setItem('user_image', userData.user.image);
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
