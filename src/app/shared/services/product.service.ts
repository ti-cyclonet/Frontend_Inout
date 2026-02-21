import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '../models/product.model';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private baseUrl: string;

  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {
    this.baseUrl = `${this.apiConfig.baseUrl}/products`;
  }

  getProducts(page: number = 1, limit: number = 10): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<any>(this.baseUrl, { params });
  }

  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`);
  }

  getComposition(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${id}/composition`);
  }

  getCompositionTwo(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${id}/composition-two`);
  }

  getCompositionThree(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${id}/composition-three`);
  }

  createProduct(product: any): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, product);
  }

  updateProduct(id: string, product: any): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/${id}`, product);
  }

  deleteProduct(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
