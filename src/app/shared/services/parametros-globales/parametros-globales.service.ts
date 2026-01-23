import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from '../api-config.service';

@Injectable({
  providedIn: 'root'
})
export class ParametrosGlobalesService {
  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  getPeriodos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiConfig.baseUrl}/periods`);
  }

  getPeriodoActivo(): Observable<any> {
    return this.http.get<any>(`${this.apiConfig.baseUrl}/periods/active/current`);
  }

  getParametrosGlobales(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiConfig.baseUrl}/parameters/global`);
  }

  crearPeriodo(periodo: any): Observable<any> {
    return this.http.post(`${this.apiConfig.baseUrl}/periods`, periodo);
  }

  activarPeriodo(periodoId: string): Observable<any> {
    return this.http.patch(`${this.apiConfig.baseUrl}/periods/${periodoId}/activate`, {});
  }

  eliminarPeriodo(periodoId: string): Observable<any> {
    return this.http.delete(`${this.apiConfig.baseUrl}/periods/${periodoId}`);
  }

  crearSubperiodo(subperiodo: any): Observable<any> {
    return this.http.post(`${this.apiConfig.baseUrl}/periods/subperiods`, subperiodo);
  }

  desactivarPeriodo(periodoId: string): Observable<any> {
    return this.http.patch(`${this.apiConfig.baseUrl}/periods/${periodoId}/deactivate`, {});
  }

  getParametrosDisponibles(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiConfig.baseUrl}/parameters/available`);
  }

  getParametrosPorPeriodo(periodoId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiConfig.baseUrl}/periods/${periodoId}/parameters`);
  }

  agregarParametrosAPeriodo(periodoId: string, parametros: any[]): Observable<any> {
    return this.http.post(`${this.apiConfig.baseUrl}/periods/${periodoId}/parameters`, { parametros });
  }

  actualizarEstadoParametro(parametroId: string, estado: string): Observable<any> {
    return this.http.patch(`${this.apiConfig.baseUrl}/parameters/${parametroId}/status`, { status: estado });
  }

  actualizarValorParametro(parametroId: string, valor: string): Observable<any> {
    return this.http.patch(`${this.apiConfig.baseUrl}/parameters/${parametroId}/value`, { value: valor });
  }

  actualizarOperationTypeParametro(parametroId: string, operationType: string): Observable<any> {
    return this.http.patch(`${this.apiConfig.baseUrl}/parameters/${parametroId}/operation-type`, { operationType });
  }

  crearParametroGlobal(parametro: any): Observable<any> {
    return this.http.post(`${this.apiConfig.baseUrl}/parameters/global`, parametro);
  }

  validateParameterName(name: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiConfig.baseUrl}/parameters/validate-name?name=${encodeURIComponent(name)}`);
  }

  eliminarParametroDePeriodo(parametroId: string): Observable<any> {
    return this.http.delete(`${this.apiConfig.baseUrl}/parameters/${parametroId}`);
  }

  guardarParametros(parametros: any[]): Observable<any> {
    return this.http.post(`${this.apiConfig.baseUrl}/parameters/bulk-save`, parametros);
  }
}