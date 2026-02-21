import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CompositionTwo {
  strId: string;
  strProductId: string;
  strMaterialId: string;
  fltQuantity: number;
}

export interface CompositionThree {
  strId: string;
  strProductId: string;
  strTransformedMaterialId: string;
  fltQuantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class CompositionService {
  private apiUrl = 'http://localhost:3001/api';

  constructor(private http: HttpClient) { }

  getCompositionTwo(): Observable<CompositionTwo[]> {
    return this.http.get<CompositionTwo[]>(`${this.apiUrl}/compositionTwo`);
  }

  getCompositionThree(): Observable<CompositionThree[]> {
    return this.http.get<CompositionThree[]>(`${this.apiUrl}/compositionThree`);
  }

  getProductComposition(productId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/products/${productId}/composition`);
  }
}