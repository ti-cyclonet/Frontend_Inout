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

/** Ítem vendible en Ventas/Pedidos: producto, material de reventa (por presentación), kit armado o combo. */
export interface SellableItem {
  id: string;
  name: string;
  price: number;
  /** Stock DISPONIBLE (físico - reservado); en presentaciones para materiales. */
  stock: number;
  itemType: 'product' | 'material' | 'material_t' | 'kit' | 'combo';
  /** Combo cuyos componentes limitantes se fabrican bajo pedido: sin tope de stock. */
  unlimited?: boolean;
}

/** Sin tope de stock (combos con componentes bajo pedido). */
export const UNLIMITED_STOCK = Number.MAX_SAFE_INTEGER;

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  private apiUrl = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) { }

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.apiUrl);
  }

  /** Todos los productos del tenant (GET /products pagina de a 10 por defecto). */
  getAllProducts(): Observable<any> {
    return this.http.get<any>(this.apiUrl, { params: { limit: '5000' } });
  }

  /** Materiales / materiales compuestos habilitados para reventa (panel). */
  getResaleItems(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/resale-items`);
  }

  /**
   * Productos + materiales de reventa + combos y kits activos en una sola
   * lista para los buscadores de Nueva Venta y Nuevo Pedido. Si falla la
   * carga de reventa o de combos, se siguen mostrando los productos.
   */
  getSellableItems(): Observable<SellableItem[]> {
    return forkJoin([
      // Antes se usaba GET /products sin límite, que solo traía los primeros 10
      this.getAllProducts(),
      this.getResaleItems().pipe(catchError(() => of([]))),
      this.http.get<any[]>(`${environment.apiUrl}/combos`).pipe(catchError(() => of([]))),
    ]).pipe(
      map(([productsResponse, resale, combos]: [any, any[], any[]]) => {
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
          // Kit armado: su stock. Combo: lo que alcanzan sus componentes (null = bajo pedido)
          ...(combos || []).filter((c: any) => c.strStatus === 'active').map((c: any): SellableItem => ({
            id: c.strId,
            name: c.strName,
            price: Number(c.fltPrice) || 0,
            stock: c.available === null || c.available === undefined ? UNLIMITED_STOCK : Number(c.available) || 0,
            itemType: c.strType === 'KIT' ? 'kit' : 'combo',
            unlimited: c.strType !== 'KIT' && (c.available === null || c.available === undefined),
          })),
        ];
      }),
    );
  }
}