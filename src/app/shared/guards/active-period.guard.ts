import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ParametrosGlobalesService } from '../services/parametros-globales/parametros-globales.service';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class ActivePeriodGuard implements CanActivate {
  constructor(
    private parametrosService: ParametrosGlobalesService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.parametrosService.getPeriodoActivo().pipe(
      map(response => {
        // Handle both array and object responses
        const periodo = Array.isArray(response) ? response[0] : response;
        
        if (periodo && (periodo.id || periodo.strId) && periodo.status === 'ACTIVE') {
          return true;
        }
        
        Swal.fire({
          icon: 'warning',
          title: 'Periodo Requerido',
          text: 'Debe crear y activar un periodo de trabajo para continuar',
          confirmButtonText: 'Ir a Configuración',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(() => {
          this.router.navigate(['/setting']);
        });
        
        return false;
      }),
      catchError(() => {
        Swal.fire({
          icon: 'warning',
          title: 'Periodo Requerido',
          text: 'Debe crear y activar un periodo de trabajo para continuar',
          confirmButtonText: 'Ir a Configuración',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(() => {
          this.router.navigate(['/setting']);
        });
        
        return of(false);
      })
    );
  }
}
