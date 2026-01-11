import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler } from '@angular/common/http';
import { AuthService } from '../services/auth/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    console.log('🔄 Interceptor ejecutándose para:', req.url);
    
    const token = this.authService.getToken();
    console.log('🔑 Token obtenido:', token ? token.substring(0, 20) + '...' : 'null');

    if (token) {
      console.log('✅ Adding Authorization header');
      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      return next.handle(authReq);
    }

    console.log('❌ No token found, proceeding without auth');
    return next.handle(req);
  }
}