import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from '../models/product.model';
import { ApiConfigService } from './api-config.service';

/** Una presentación de venta de la familia de un producto. */
export interface ProductPresentation {
  strId: string;
  strCode: string;
  strName: string;
  strVariantLabel: string | null;
  fltPrice: number;
  ingQuantity: number;
  blnMarketplaceVisible: boolean;
  isMain: boolean;
}

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

  /** Presentaciones de venta de la familia del producto (8 oz, 12 oz…). */
  getPresentations(id: string): Observable<ProductPresentation[]> {
    return this.http.get<ProductPresentation[]>(`${this.baseUrl}/${id}/presentations`);
  }

  /** Nueva presentación: copia el producto y su receta con stock en cero. */
  createPresentation(id: string, body: { label: string; sourceLabel?: string; price?: number }): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/${id}/presentations`, body);
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
