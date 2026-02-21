import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private apiUrl = 'http://localhost:3001/api/stock';

  constructor(private http: HttpClient) { }

  updateProductStock(productId: string, quantity: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/product/${productId}`, { quantity });
  }

  processSaleStock(saleData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/process-sale`, saleData);
  }
}