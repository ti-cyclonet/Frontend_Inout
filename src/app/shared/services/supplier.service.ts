import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Supplier } from '../models/supplier.model';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<any[]>(`${this.apiConfig.baseUrl}/suppliers`).pipe(
      map(suppliers => suppliers.map(s => ({
        id: s.strId,
        name: s.strName,
        contactName: s.strContactName,
        address: s.strAddress,
        documentType: s.strDocumentType,
        documentNumber: s.strDocumentNumber,
        contactEmail: s.strContactEmail,
        contactPhone: s.strContactPhone,
        status: s.strStatus
      }))),
      catchError(() => of([]))
    );
  }

  createSupplier(supplier: Omit<Supplier, 'id'>): Observable<Supplier> {
    return this.http.post<any>(`${this.apiConfig.baseUrl}/suppliers`, supplier).pipe(
      map(s => ({
        id: s.strId,
        name: s.strName,
        contactName: s.strContactName,
        address: s.strAddress,
        documentType: s.strDocumentType,
        documentNumber: s.strDocumentNumber,
        contactEmail: s.strContactEmail,
        contactPhone: s.strContactPhone,
        status: s.strStatus
      })),
      catchError(error => {
        throw error;
      })
    );
  }
}
