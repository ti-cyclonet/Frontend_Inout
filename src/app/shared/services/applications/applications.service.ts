import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Application } from '../../model/application.model';

@Injectable({
  providedIn: 'root',
})
export class ApplicationsService {
  private applicationsSubject = new BehaviorSubject<Application[]>([]);
  public applications$ = this.applicationsSubject.asObservable();


  private AuthorizaApiUrl = '/api/applications';
 
  constructor(private http: HttpClient) {}

  // Método para obtener una aplicación por nombre
  getApplicationByName(strName: string): Observable<Application> {
    return this.http.get<Application>(`http://localhost:3000/api/applications/${strName}`);
    //return this.http.get<Application>(`${this.AuthorizaApiUrl}/${strName}`);
  }
  
}
