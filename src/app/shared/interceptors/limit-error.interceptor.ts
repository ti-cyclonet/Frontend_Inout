import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Injectable()
export class LimitErrorInterceptor implements HttpInterceptor {
  constructor(private readonly router: Router) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 403 && error.error) {
          if (error.error.error === 'LIMIT_REACHED') {
            const resource = error.error.resource ?? 'recurso';
            const limit = error.error.limit ?? '—';
            const currentCount = error.error.currentCount ?? '—';

            Swal.fire({
              icon: 'warning',
              title: 'Límite alcanzado',
              html: `Has alcanzado el límite máximo de <b>${resource}</b>.<br>` +
                `Límite: <b>${limit}</b> | Uso actual: <b>${currentCount}</b>.<br><br>` +
                `Para ampliarlo, cambia de plan en Mi plan.`,
              showCancelButton: true,
              confirmButtonText: 'Ver planes',
              cancelButtonText: 'Entendido',
            }).then((r) => { if (r.isConfirmed) this.router.navigate(['/plan']); });
          } else if (error.error.error === 'FEATURE_DISABLED') {
            Swal.fire({
              icon: 'info',
              title: 'Función no incluida en tu plan',
              text: error.error.message ?? 'Tu plan no incluye esta función. Para usarla, cambia de plan en Mi plan.',
              showCancelButton: true,
              confirmButtonText: 'Ver planes',
              cancelButtonText: 'Entendido',
            }).then((r) => { if (r.isConfirmed) this.router.navigate(['/plan']); });
          } else if (error.error.error === 'CONTRACT_INACTIVE') {
            const message =
              error.error.message ??
              'El contrato del tenant está suspendido o cancelado';

            Swal.fire({
              icon: 'warning',
              title: 'Contrato inactivo',
              text: message,
              confirmButtonText: 'Entendido',
            });
          }
        }

        return throwError(() => error);
      })
    );
  }
}
