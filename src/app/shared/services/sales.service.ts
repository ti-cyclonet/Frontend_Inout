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
  /** Volante del datáfono / comprobante del pago (foto) y su referencia. */
  strPaymentProofUrl?: string | null;
  strPaymentReference?: string | null;
  /** Pago de contado dividido en varios medios. */
  payments?: { method: string; amount: number }[] | null;
  paymentMethod?: string | null;
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
  /** Pago de contado dividido en varios medios. */
  payments?: { method: string; amount: number }[];
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

  /** Adjunta el volante (foto) y/o el N° de aprobación de una venta de contado no en efectivo. */
  attachPaymentProof(id: string, file: File | null, reference: string): Observable<Sale> {
    const form = new FormData();
    if (file) form.append('file', file);
    if (reference.trim()) form.append('reference', reference.trim());
    return this.http.post<Sale>(`${this.apiUrl}/${id}/payment-proof`, form);
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