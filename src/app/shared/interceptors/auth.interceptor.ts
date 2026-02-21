import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler } from '@angular/common/http';
import { AuthService } from '../services/auth/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
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