import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Product {
  strId: string;
  strName: string;
  strDescription: string;
  fltPrice: number;
  ingQuantity: number;
  strCode: string;
  strStatus: string;
}

/** Ítem vendible en Ventas/Pedidos: producto o material de reventa (por presentación). */
export interface SellableItem {
  id: string;
  name: string;
  price: number;
  /** Stock DISPONIBLE (físico - reservado); en presentaciones para materiales. */
  stock: number;
  itemType: 'product' | 'material' | 'material_t';
}

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private apiUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) { }

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl);
  }

  /** Materiales / materiales compuestos habilitados para reventa (panel). */
  getResaleItems(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/resale-items`);
  }

  /**
   * Productos + materiales de reventa en una sola lista para los buscadores
   * de Nueva Venta y Nuevo Pedido. Si falla la carga de reventa, se siguen
   * mostrando los productos.
   */
  getSellableItems(): Observable<SellableItem[]> {
    return forkJoin([
      this.getProducts(),
      this.getResaleItems().pipe(catchError(() => of([]))),
    ]).pipe(
      map(([productsResponse, resale]: [any, any[]]) => {
        const products = (productsResponse?.data || productsResponse || []) as any[];
        return [
          ...products.map((p: any): SellableItem => ({
            id: p.strId,
            name: p.strName,
            price: Number(p.fltPrice) || 0,
            stock: Math.max(0, Number(p.ingQuantity || 0) - Number(p.ingReservedStock || 0)),
            itemType: 'product',
          })),
          // El backend ya entrega precio y stock por presentación
          ...(resale || []).map((m: any): SellableItem => ({
            id: m.strId,
            name: m.strName,
            price: Number(m.fltPrice) || 0,
            stock: Number(m.ingQuantity) || 0,
            itemType: m.itemType,
          })),
        ];
      }),
    );
  }
}