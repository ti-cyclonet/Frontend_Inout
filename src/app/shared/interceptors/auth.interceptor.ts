import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler } from '@angular/common/http';
import { AuthService } from '../services/auth/auth.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    // Las llamadas a la API de Shotra NO deben llevar el token/tenant de InOut:
    // Shotra rechaza tokens de otras apps. El ShotraService adjunta su propio
    // token (obtenido vía switch-app) explícitamente, así que aquí se omiten.
    if (req.url.startsWith(environment.shotra.apiUrl)) {
      return next.handle(req);
    }

    const token = this.authService.getToken();
    let tenantId: string | null = null;

    // No agregar x-tenant-id en las peticiones de login
    const isLoginRequest = req.url.includes('/auth/login');

    if (typeof window !== 'undefined' && !isLoginRequest) {
      tenantId = sessionStorage.getItem('user_id');
    }

    let authReq = req;

    if (token) {
      authReq = authReq.clone({
        headers: authReq.headers.set('Authorization', `Bearer ${token}`)
      });
    }

    if (tenantId) {
      authReq = authReq.clone({
        headers: authReq.headers.set('x-tenant-id', tenantId)
      });
    }

    return next.handle(authReq);
  }
}