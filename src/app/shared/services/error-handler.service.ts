import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {

  constructor() {}

  handleError(error: HttpErrorResponse): Observable<never> {
    let apiError: ApiError;

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      apiError = {
        message: 'Error de conexión. Verifica tu conexión a internet.',
        code: 'CLIENT_ERROR',
        details: error.error.message
      };
    } else {
      // Server-side error
      switch (error.status) {
        case 400:
          apiError = {
            message: 'Datos inválidos. Verifica la información enviada.',
            code: 'BAD_REQUEST',
            details: error.error
          };
          break;
        case 401:
          apiError = {
            message: 'No autorizado. Tu sesión ha expirado.',
            code: 'UNAUTHORIZED',
            details: error.error
          };
          // Clear token and redirect to login
          localStorage.removeItem('authToken');
          break;
        case 403:
          apiError = {
            message: 'No tienes permisos para realizar esta acción.',
            code: 'FORBIDDEN',
            details: error.error
          };
          break;
        case 404:
          apiError = {
            message: 'Recurso no encontrado.',
            code: 'NOT_FOUND',
            details: error.error
          };
          break;
        case 409:
          apiError = {
            message: 'Conflicto. El recurso ya existe o está en uso.',
            code: 'CONFLICT',
            details: error.error
          };
          break;
        case 422:
          apiError = {
            message: 'Datos no válidos para procesar.',
            code: 'UNPROCESSABLE_ENTITY',
            details: error.error
          };
          break;
        case 500:
          apiError = {
            message: 'Error interno del servidor. Intenta más tarde.',
            code: 'INTERNAL_SERVER_ERROR',
            details: error.error
          };
          break;
        default:
          apiError = {
            message: `Error inesperado: ${error.status}`,
            code: 'UNKNOWN_ERROR',
            details: error.error
          };
      }
    }

    console.error('API Error:', apiError);
    return throwError(apiError);
  }

  getErrorMessage(error: any): string {
    if (error && error.message) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    return 'Ha ocurrido un error inesperado';
  }
}