import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Application } from '../../model/application.model';
import { environment } from '../../../../../environment/environment';
@Injectable({
  providedIn: 'root',
})
export class ApplicationsService {
  private applicationsSubject = new BehaviorSubject<Application[]>([]);
  public applications$ = this.applicationsSubject.asObservable();

  private AuthorizaApiUrl = `${environment.BASE_URL_AUTHORIZA}/api/applications`;  
 
  constructor(private http: HttpClient) {}

  // Método para obtener una aplicación por nombre
  getApplicationByName(strName: string): Observable<Application> {
    return this.http.get<Application>(`${this.AuthorizaApiUrl}/${strName}`);
  }

  // Obtener una aplicación y sus opciones de menú por nombre de aplicación y nombre de rol
  getApplicationByNameAndRol(applicationName: string, rolName: string): Observable<Application> {
    const url = `${this.AuthorizaApiUrl}/${applicationName}/rol/${rolName}`;    
    return this.http.get<Application>(url);
  }
}
