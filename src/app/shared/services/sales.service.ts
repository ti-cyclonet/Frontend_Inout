import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Sale {
  strId?: string;
  strTenantId?: string;
  strInvoiceCode?: string;
  strProductId?: string;
  dtmDate?: string;
  fltQuantity?: number;
  fltUnitPrice?: number;
  customerName?: string;
  dtmCreationDate?: string;
  items?: any;
  subtotal?: number;
  tax?: number;
  total?: number;
  paymentType?: string;
  /** Anulada: el stock volvió al inventario y no cuenta como venta. */
  dtmVoidedAt?: string | null;
  strVoidReason?: string | null;
  strVoidedBy?: string | null;
}

export interface SaleItem {
  id?: string;
  saleId?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CreateSaleDto {
  strTenantId: string;
  strProductId: string;
  dtmDate: string;
  fltQuantity: number;
  fltUnitPrice: number;
  customerName?: string;
  /** userId del cliente en Authoriza (obligatorio para vender a crédito). */
  customerId?: string;
  items?: any;
  subtotal?: number;
  tax?: number;
  total?: number;
  paymentType?: 'CONTADO' | 'CREDITO';
  paymentMethod?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  private apiUrl = `${environment.apiUrl}/sales`;

  constructor(private http: HttpClient) { }

  createSale(sale: CreateSaleDto): Observable<Sale> {
    return this.http.post<Sale>(this.apiUrl, sale);
  }

  /** Ventas vigentes; con includeVoided también las anuladas (lista de ventas). */
  getSales(includeVoided = false): Observable<Sale[]> {
    return this.http.get<Sale[]>(this.apiUrl, includeVoided ? { params: { anuladas: '1' } } : {});
  }

  /** Anula una venta registrada por error (solo administrador): devuelve el stock. */
  voidSale(id: string, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/void`, { reason });
  }

  getStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stats`);
  }

  getSaleById(id: string): Observable<Sale> {
    return this.http.get<Sale>(`${this.apiUrl}/${id}`);
  }
}