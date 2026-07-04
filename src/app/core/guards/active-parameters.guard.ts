import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ActiveParametersGuard implements CanActivate {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.http.get<any>(`${this.baseUrl}/periods/active/current`).pipe(
      switchMap(periodo => {
        if (!periodo) {
          Swal.fire('Advertencia', 'No se encontró un período activo. Por favor, activa un período primero.', 'warning');
          this.router.navigate(['/setting']);
          return of(false);
        }
        
        return this.http.get<any[]>(`${this.baseUrl}/periods/${periodo.id}/customer-parameters`).pipe(
          map(params => {
            const hasActiveParams = params.some(p => p.status === 'active' || p.status === 'ACTIVE');
            if (!hasActiveParams) {
              Swal.fire('Advertencia', 'El período activo debe tener al menos un parámetro activo. Por favor, configura los parámetros.', 'warning');
              this.router.navigate(['/setting']);
              return false;
            }
            return true;
          })
        );
      }),
      catchError(() => {
        this.router.navigate(['/setting']);
        return of(false);
      })
    );
  }
}
