import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  items?: any;
  subtotal?: number;
  tax?: number;
  total?: number;
}

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  private apiUrl = 'http://localhost:3001/api/sales';

  constructor(private http: HttpClient) { }

  createSale(sale: CreateSaleDto): Observable<Sale> {
    return this.http.post<Sale>(this.apiUrl, sale);
  }

  getSales(): Observable<Sale[]> {
    return this.http.get<Sale[]>(this.apiUrl);
  }

  getStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stats`);
  }

  getSaleById(id: string): Observable<Sale> {
    return this.http.get<Sale>(`${this.apiUrl}/${id}`);
  }
}