import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class ActiveParametersGuard implements CanActivate {
  private baseUrl = 'http://localhost:3001/api';

  constructor(private http: HttpClient, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.http.get<any>(`${this.baseUrl}/periods/active/current`).pipe(
      switchMap(periodo => {
        if (!periodo) {
          Swal.fire('Warning', 'No active period found. Please activate a period first.', 'warning');
          this.router.navigate(['/setting']);
          return of(false);
        }
        
        return this.http.get<any[]>(`${this.baseUrl}/periods/${periodo.id}/customer-parameters`).pipe(
          map(params => {
            const hasActiveParams = params.some(p => p.status === 'active' || p.status === 'ACTIVE');
            if (!hasActiveParams) {
              Swal.fire('Warning', 'The active period must have at least one active parameter. Please configure parameters.', 'warning');
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
