import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface KardexMovement {
  entityId: string;
  entityType: 'material' | 'composite' | 'product';
  movementType: 'entry' | 'output';
  quantity: number;
  unitValue: number;
  totalPrice: number;
  date: string;
  concept: string;
  document: string;
}

@Injectable({
  providedIn: 'root'
})
export class KardexService {
  private apiUrl = 'http://localhost:3001/api/kardex';

  constructor(private http: HttpClient) { }

  createMovement(movement: KardexMovement): Observable<any> {
    return this.http.post(`${this.apiUrl}/movements`, movement);
  }

  createSaleMovements(saleId: string, items: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/sale-movements`, { saleId, items });
  }
}