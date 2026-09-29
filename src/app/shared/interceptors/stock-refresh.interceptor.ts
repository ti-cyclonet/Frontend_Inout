import { Injectable, Injector } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StockAlertsService } from '../services/stock-alerts.service';
import { AuthService } from '../services/auth/auth.service';

const MUTATIONS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Mantiene al día los contadores de alertas de stock del menú lateral: tras
 * cualquier escritura exitosa contra la API de InOut (compras, producción,
 * ajustes, pedidos, ventas, transferencias…) se recalculan. Antes cada
 * pantalla debía llamar refreshAlerts() y varias no lo hacían (p. ej. el
 * registro de compras), así que los contadores quedaban desactualizados.
 */
@Injectable()
export class StockRefreshInterceptor implements HttpInterceptor {
  // Se resuelven perezosamente: StockAlertsService usa HttpClient y eso crearía
  // una dependencia circular con los interceptores.
  constructor(private injector: Injector) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const affectsStock = MUTATIONS.includes(req.method)
      && req.url.startsWith(environment.apiUrl)
      && !req.url.includes('/stock/alerts');
    if (!affectsStock) return next.handle(req);

    return next.handle(req).pipe(
      tap((event) => {
        if (!(event instanceof HttpResponse)) return;
        // Solo con sesión del panel (el MarketPlace público no tiene alertas)
        if (!this.injector.get(AuthService).getToken()) return;
        this.injector.get(StockAlertsService).scheduleRefresh();
      }),
    );
  }
}
